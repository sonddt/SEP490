using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.BackgroundServices;

/// <summary>
/// Chạy mỗi 5 phút — quét các booking CONFIRMED mà tất cả booking_items
/// đã kết thúc (end_time ≤ UTC now) → chuyển sang COMPLETED.
/// Đồng thời kiểm tra series: nếu tất cả bookings trong series đều COMPLETED
/// thì series cũng chuyển sang COMPLETED.
/// </summary>
public sealed class BookingCompletionService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BookingCompletionService> _logger;

    public BookingCompletionService(
        IServiceScopeFactory scopeFactory,
        ILogger<BookingCompletionService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Chờ 30s sau khi app khởi động để DB ổn định
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CompleteExpiredBookingsAsync(stoppingToken);
                await CancelExpiredPendingBookingsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[BookingCompletion] Oops — có lỗi khi chuyển booking sang COMPLETED");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CompleteExpiredBookingsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();

        var nowUtc = DateTime.UtcNow;
        var vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTimeZone);

        // Lấy tất cả booking CONFIRMED mà KHÔNG còn item nào có end_time > nowVn
        // (tức tất cả items đều đã kết thúc theo giờ Việt Nam)
        var eligibleBookings = await db.Bookings
            .Include(b => b.BookingItems)
            .Where(b => b.Status == "CONFIRMED"
                && b.BookingItems.Count > 0
                && b.BookingItems.All(bi => bi.EndTime != null && bi.EndTime <= nowVn))
            .ToListAsync(ct);

        if (eligibleBookings.Count == 0) return;

        var affectedSeriesIds = new HashSet<Guid>();

        foreach (var booking in eligibleBookings)
        {
            booking.Status = "COMPLETED";
            booking.CompletedAt = nowUtc;

            foreach (var item in booking.BookingItems)
            {
                item.Status = "COMPLETED";
            }

            if (booking.SeriesId.HasValue)
            {
                affectedSeriesIds.Add(booking.SeriesId.Value);
            }
        }

        // Kiểm tra series — nếu tất cả bookings trong series đều COMPLETED → series COMPLETED
        if (affectedSeriesIds.Count > 0)
        {
            var seriesWithBookings = await db.BookingSeries
                .Include(s => s.Bookings)
                .Where(s => affectedSeriesIds.Contains(s.Id) && s.Status != "COMPLETED")
                .ToListAsync(ct);

            foreach (var series in seriesWithBookings)
            {
                var allCompleted = series.Bookings.All(b =>
                    b.Status == "COMPLETED" || b.Status == "CANCELLED"
                    || b.Status == "REFUNDED");

                var hasAtLeastOneCompleted = series.Bookings.Any(b => b.Status == "COMPLETED");

                if (allCompleted && hasAtLeastOneCompleted)
                {
                    series.Status = "COMPLETED";
                }
            }
        }

        await db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "[BookingCompletion] Đã chuyển {Count} booking sang COMPLETED",
            eligibleBookings.Count);
    }

    private async Task CancelExpiredPendingBookingsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();

        var nowUtc = DateTime.UtcNow;
        var vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTimeZone);

        var eligibleBookings = await db.Bookings
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .Include(b => b.Venue)
            .Where(b => b.Status == "PENDING"
                && b.BookingItems.Count > 0
                && b.BookingItems.Min(bi => bi.StartTime) <= nowVn)
            .ToListAsync(ct);

        if (eligibleBookings.Count == 0) return;

        var _notify = scope.ServiceProvider.GetRequiredService<ShuttleUp.BLL.Interfaces.INotificationDispatchService>();
        var _matchingPostLifecycle = scope.ServiceProvider.GetRequiredService<ShuttleUp.BLL.Interfaces.IMatchingPostLifecycleService>();

        var affectedSeriesIds = new HashSet<Guid>();

        foreach (var booking in eligibleBookings)
        {
            var hasPaymentProof = booking.Payments.Any(p => 
                !string.IsNullOrWhiteSpace(p.GatewayReference) 
                && p.GatewayReference.TrimStart().StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                && p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase));

            var proofAmount = booking.Payments
                .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount ?? 0);

            if (hasPaymentProof)
            {
                booking.Status = "PENDING_RECONCILIATION";
                db.RefundRequests.Add(new RefundRequest
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    UserId = booking.UserId,
                    ReasonCode = "SYSTEM_LATE_APPROVAL",
                    Status = "PENDING_RECONCILIATION",
                    RequestedAmount = proofAmount > 0 ? proofAmount : (booking.FinalAmount ?? booking.TotalAmount),
                    PlayerNote = "Chủ sân không duyệt trước giờ thi đấu",
                    RequestedAt = DateTime.UtcNow,
                });
            }
            else
            {
                booking.Status = "CANCELLED";
            }

            foreach (var item in booking.BookingItems)
                item.Status = (booking.Status is "CANCELLED" or "PENDING_REFUND" or "PENDING_RECONCILIATION") ? "CANCELLED" : item.Status;

            foreach (var p in booking.Payments.Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = booking.Status == "CANCELLED" ? "CANCELLED" : p.Status;

            if (booking.SeriesId.HasValue)
                affectedSeriesIds.Add(booking.SeriesId.Value);

            // Notify User
            if (booking.UserId is { } playerId)
            {
                var venueName = booking.Venue?.Name ?? "sân";
                var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
                
                string title, body;
                if (booking.Status == "PENDING_RECONCILIATION")
                {
                    title = "Đơn đặt sân bị huỷ — chờ hoàn tiền";
                    body = $"Mã #{code} tại {venueName} đã bị huỷ do chủ sân duyệt trễ. Hệ thống đang đối soát hoàn tiền 100% cho bạn.";
                }
                else
                {
                    title = "Đơn đặt sân đã bị huỷ";
                    body = $"Mã #{code} tại {venueName} đã tự động bị huỷ do quá hạn duyệt.";
                }

                await _notify.NotifyUserAsync(playerId, ShuttleUp.BLL.Constants.NotificationTypes.Booking, title, body,
                    new { bookingId = booking.Id, status = booking.Status, entityType = "booking", deepLink = $"/user/bookings?bookingId={booking.Id}" },
                    sendEmail: true, cancellationToken: ct);
            }

            // Notify Manager
            if (booking.Venue?.OwnerUserId is { } managerId)
            {
                var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(managerId, ShuttleUp.BLL.Constants.NotificationTypes.Booking,
                    "Đơn đặt sân tự động bị huỷ",
                    $"Hệ thống đã tự động huỷ đơn #{code} do quá hạn duyệt.",
                    new { bookingId = booking.Id, status = booking.Status, entityType = "booking", deepLink = $"/manager/bookings" },
                    sendEmail: false, cancellationToken: ct);
            }
            
            // Cancel matching posts if cancelled
            if (booking.Status == "CANCELLED")
                await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "hệ thống tự động", ct);
        }

        // Series logic
        if (affectedSeriesIds.Count > 0)
        {
            var seriesWithBookings = await db.BookingSeries
                .Include(s => s.Bookings)
                .Where(s => affectedSeriesIds.Contains(s.Id) && s.Status != "COMPLETED" && s.Status != "CANCELLED")
                .ToListAsync(ct);

            foreach (var series in seriesWithBookings)
            {
                var allCompleted = series.Bookings.All(b => b.Status == "COMPLETED" || b.Status == "CANCELLED" || b.Status == "REFUNDED" || b.Status == "PENDING_RECONCILIATION" || b.Status == "PENDING_REFUND");
                var hasAtLeastOneCompleted = series.Bookings.Any(b => b.Status == "COMPLETED");

                if (allCompleted)
                {
                    series.Status = hasAtLeastOneCompleted ? "COMPLETED" : "CANCELLED";
                }
            }
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("[BookingCompletion] Đã huỷ tự động {Count} đơn PENDING quá hạn", eligibleBookings.Count);
    }
}

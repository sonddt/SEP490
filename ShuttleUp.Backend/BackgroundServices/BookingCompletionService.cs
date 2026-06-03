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
}

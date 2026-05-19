using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Policy;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Services;

public class RefundService : IRefundService
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly INotificationDispatchService _notify;

    public RefundService(ShuttleUpDbContext dbContext, INotificationDispatchService notify)
    {
        _dbContext = dbContext;
        _notify = notify;
    }

    public async Task<RefundActionResult> ReconcileAsync(
        Guid refundId, Guid managerId, bool confirmed, string? reason, CancellationToken ct)
    {
        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Payments)
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .Include(r => r.Booking).ThenInclude(b => b!.BookingItems)
            .FirstOrDefaultAsync(r => r.Id == refundId, ct);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();

        if (refund.Status != "PENDING_RECONCILIATION")
            throw new ArgumentException("Yêu cầu không ở trạng thái cần đối soát.");

        if (confirmed)
        {
            var paidAmount = refund.Booking!.Payments
                .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount ?? 0);

            foreach (var p in refund.Booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "COMPLETED";
                p.ConfirmedBy = managerId;
                p.ConfirmedAt = DateTime.UtcNow;
            }

            var policy = ParsePolicyOrDefault(refund.Booking.CancellationPolicySnapshotJson);
            var refundAmount = policy.ComputeRefundAmount(paidAmount);

            refund.Status = "PENDING_REFUND";
            refund.PaidAmount = paidAmount;
            refund.RequestedAmount = refundAmount;
            refund.Booking.Status = "PENDING_REFUND";

            await _dbContext.SaveChangesAsync(ct);

            if (refund.UserId.HasValue)
            {
                var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(
                    refund.UserId.Value,
                    NotificationTypes.RefundReconciled,
                    "Chủ sân đã xác nhận nhận tiền",
                    $"Đơn #{code}: Chủ sân đã xác nhận nhận được chuyển khoản. Hoàn tiền đang xử lý.",
                    new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                    sendEmail: false,
                    cancellationToken: ct);
            }

            return new RefundActionResult
            {
                Message = "Đã xác nhận nhận tiền. Đơn chuyển sang chờ hoàn tiền.",
                Status = "PENDING_REFUND"
            };
        }
        else
        {
            if (string.IsNullOrWhiteSpace(reason))
                throw new ArgumentException("Vui lòng nhập lý do từ chối để người chơi được biết.");

            refund.Status = "REJECTED";
            refund.RejectionReason = reason.Trim();
            refund.ProcessedBy = managerId;
            refund.ProcessedAt = DateTime.UtcNow;
            refund.Booking!.Status = "CANCELLED";

            foreach (var item in refund.Booking.BookingItems ?? Enumerable.Empty<BookingItem>())
                item.Status = "CANCELLED";
            foreach (var p in refund.Booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";

            await _dbContext.SaveChangesAsync(ct);

            if (refund.UserId.HasValue)
            {
                var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(
                    refund.UserId.Value,
                    NotificationTypes.RefundRejected,
                    "Yêu cầu hoàn tiền bị từ chối",
                    $"Đơn #{code}: {refund.RejectionReason}",
                    new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                    sendEmail: false,
                    cancellationToken: ct);
            }

            return new RefundActionResult
            {
                Message = "Đã từ chối. Đơn chuyển sang Đã hủy.",
                Status = "REJECTED"
            };
        }
    }

    public async Task<RefundActionResult> CompleteRefundAsync(
        Guid refundId, Guid managerId, string? managerNote, CancellationToken ct)
    {
        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .FirstOrDefaultAsync(r => r.Id == refundId, ct);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();

        if (refund.Status != "PENDING_REFUND")
            throw new ArgumentException("Yêu cầu không ở trạng thái chờ hoàn tiền.");

        if (refund.ManagerEvidenceFileId == null)
            throw new ArgumentException("Oops… Bạn cần tải ảnh biên lai chuyển khoản hoàn tiền trước khi đánh dấu hoàn tất.");

        refund.Status = "COMPLETED";
        refund.ProcessedBy = managerId;
        refund.ProcessedAt = DateTime.UtcNow;
        refund.ManagerNote = managerNote?.Trim();
        refund.Booking!.Status = "REFUNDED";

        if (refund.Booking.SeriesId is { } sid)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == sid, ct);
            if (series != null) series.Status = "REFUNDED";
        }

        await _dbContext.SaveChangesAsync(ct);

        if (refund.UserId.HasValue)
        {
            var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
            await _notify.NotifyUserAsync(
                refund.UserId.Value,
                NotificationTypes.RefundCompleted,
                "Hoàn tiền thành công",
                $"Đơn #{code}: Chủ sân đã chuyển khoản hoàn tiền {(refund.RequestedAmount ?? 0).ToString("N0")} ₫. Vui lòng kiểm tra tài khoản.",
                new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                sendEmail: true,
                cancellationToken: ct);
        }

        return new RefundActionResult { Message = "Đã hoàn tất hoàn tiền.", Status = "COMPLETED" };
    }

    public async Task UploadEvidenceAsync(Guid refundId, Guid managerId, Guid fileEntityId, CancellationToken ct)
    {
        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .FirstOrDefaultAsync(r => r.Id == refundId, ct);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();

        refund.ManagerEvidenceFileId = fileEntityId;
        await _dbContext.SaveChangesAsync(ct);
    }

    private static CancellationPolicySnapshotDto ParsePolicyOrDefault(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new CancellationPolicySnapshotDto();
        try
        {
            return JsonSerializer.Deserialize<CancellationPolicySnapshotDto>(json) ?? new CancellationPolicySnapshotDto();
        }
        catch
        {
            return new CancellationPolicySnapshotDto();
        }
    }
}

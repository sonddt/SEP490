using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Services;

public class ManagerBookingService : IManagerBookingService
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;

    public ManagerBookingService(
        ShuttleUpDbContext dbContext,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle)
    {
        _dbContext = dbContext;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
    }

    public async Task<ManagerBookingPatchResult> PatchStatusAsync(
        Guid bookingId, Guid managerId, string status, string? reason, CancellationToken ct)
    {
        var next = status.Trim().ToUpperInvariant();
        if (next is not ("CONFIRMED" or "CANCELLED"))
            throw new ArgumentException("Trạng thái không hợp lệ (CONFIRMED | CANCELLED).");

        var booking = await _dbContext.Bookings
            .Include(b => b.Venue)
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();

        if (booking.Status == "CANCELLED")
            throw new ArgumentException("Đơn đã bị huỷ.");

        if (next == "CONFIRMED")
        {
            if (booking.Status != "PENDING")
                throw new ArgumentException("Chỉ có thể duyệt đơn đang chờ.");

            if (!HasHttpsPaymentProof(booking.Payments))
                throw new ArgumentException("Chưa có chứng từ chuyển khoản hợp lệ (URL https). Người chơi cần tải ảnh CK lên trước khi duyệt.");

            booking.Status = "CONFIRMED";
            booking.ManagerStatusNote = null;
            foreach (var item in booking.BookingItems)
                item.Status = "CONFIRMED";

            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "COMPLETED";
                p.ConfirmedBy = managerId;
                p.ConfirmedAt = DateTime.UtcNow;
            }
        }
        else
        {
            if (booking.Status != "PENDING" && booking.Status != "CONFIRMED")
                throw new ArgumentException("Không thể huỷ đơn ở trạng thái này.");

            booking.ManagerStatusNote = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();

            var hasConfirmedPayment = booking.Payments.Any(p =>
                p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase));
            var paidAmount = booking.Payments
                .Where(p => p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount ?? 0);

            if (hasConfirmedPayment && paidAmount > 0)
            {
                booking.Status = "PENDING_REFUND";
                var refundReq = new RefundRequest
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    UserId = booking.UserId,
                    ReasonCode = "MANAGER_CANCEL",
                    Status = "PENDING_REFUND",
                    RequestedAmount = paidAmount,
                    PaidAmount = paidAmount,
                    RequestedAt = DateTime.UtcNow,
                };
                _dbContext.RefundRequests.Add(refundReq);
            }
            else
            {
                booking.Status = "CANCELLED";
            }

            foreach (var item in booking.BookingItems)
                item.Status = booking.Status == "CANCELLED" ? "CANCELLED" : item.Status;

            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "CANCELLED";
            }
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
            if (series != null)
                series.Status = next == "CONFIRMED" ? "ACTIVE" : "CANCELLED";
        }

        await _dbContext.SaveChangesAsync(ct);

        if (next == "CANCELLED")
            await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "chủ sân", ct);

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        if (booking.UserId is { } playerId)
        {
            var venueName = booking.Venue?.Name ?? "sân";
            var reasonText = string.IsNullOrWhiteSpace(booking.ManagerStatusNote)
                ? "Đơn đã bị huỷ/từ chối."
                : booking.ManagerStatusNote;

            var title = next == "CONFIRMED" ? "Đơn đặt sân đã được duyệt" : "Đơn đặt sân đã bị huỷ";
            var body = next == "CONFIRMED"
                ? $"Mã #{code} tại {venueName} đã được chủ sân xác nhận."
                : $"Mã #{code} tại {venueName} đã bị huỷ bởi chủ sân. Lý do: {reasonText}";

            string? htmlBody = null;
            if (next != "CONFIRMED" && booking.Status == "PENDING_REFUND")
            {
                htmlBody = $"""
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
                      <h2 style="color:#097E52">ShuttleUp</h2>
                      <p style="font-size:16px;font-weight:600;color:#1e293b">{System.Net.WebUtility.HtmlEncode(title)}</p>
                      <p style="margin:12px 0;color:#334155">Mã đặt sân: <strong>#{code}</strong> tại <strong>{System.Net.WebUtility.HtmlEncode(venueName)}</strong></p>
                      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin:12px 0">
                        <p style="margin:0;color:#ef4444;font-weight:600"><strong>Lý do huỷ:</strong></p>
                        <p style="margin:4px 0 0;color:#dc2626">{System.Net.WebUtility.HtmlEncode(reasonText)}</p>
                      </div>
                      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin:12px 0">
                        <p style="margin:0;color:#92400e;font-weight:600">💰 Thông báo hoàn tiền</p>
                        <p style="margin:4px 0 0;color:#92400e">Đơn của bạn đã thanh toán và đủ điều kiện hoàn tiền. Vui lòng đăng nhập vào ShuttleUp và cung cấp thông tin tài khoản ngân hàng nhận tiền hoàn tại mục <strong>Đặt sân của tôi</strong> để chúng tôi xử lý hoàn tiền sớm nhất.</p>
                      </div>
                      <p style="color:#94a3b8;font-size:12px">Bạn nhận được email này vì có hoạt động liên quan tài khoản ShuttleUp.</p>
                    </div>
                    """;
            }

            await _notify.NotifyUserAsync(
                playerId,
                NotificationTypes.Booking,
                title,
                body,
                new
                {
                    bookingId = booking.Id,
                    status = booking.Status,
                    entityType = "booking",
                    deepLink = $"/user/bookings?bookingId={booking.Id}",
                },
                sendEmail: true,
                bookingStatusPayload: new
                {
                    bookingId = booking.Id,
                    status = booking.Status,
                    title,
                    body,
                },
                htmlBodyOverride: htmlBody,
                cancellationToken: ct);
        }

        return new ManagerBookingPatchResult
        {
            BookingId = booking.Id,
            BookingCode = code,
            Status = booking.Status!,
            Reason = reason,
            ManagerStatusNote = booking.ManagerStatusNote,
        };
    }

    private static bool HasHttpsPaymentProof(IEnumerable<Payment> payments) =>
        payments.Any(p =>
            !string.IsNullOrWhiteSpace(p.GatewayReference)
            && p.GatewayReference.TrimStart().StartsWith("https://", StringComparison.OrdinalIgnoreCase));
}

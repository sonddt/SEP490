using System.Text.Json;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.DTOs.Policy;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class RefundService : IRefundService
{
    private readonly IRefundRepository _refundRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IVenueRepository _venueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationDispatchService _notify;

    public RefundService(
        IRefundRepository refundRepository,
        IBookingRepository bookingRepository,
        IVenueRepository venueRepository,
        IUnitOfWork unitOfWork,
        INotificationDispatchService notify)
    {
        _refundRepository = refundRepository;
        _bookingRepository = bookingRepository;
        _venueRepository = venueRepository;
        _unitOfWork = unitOfWork;
        _notify = notify;
    }

    public async Task<RefundActionResult> ReconcileAsync(
        Guid refundId, Guid managerId, bool confirmed, string? reason, CancellationToken ct)
    {
        var refund = await _refundRepository.GetByIdForManagerAsync(refundId, ct);
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
            refund.Status = "PENDING_REFUND";
            refund.PaidAmount = paidAmount;
            refund.RequestedAmount = policy.ComputeRefundAmount(paidAmount);
            refund.Booking.Status = "PENDING_REFUND";

            await _refundRepository.UpdateAsync(refund, saveChanges: false);
            await _unitOfWork.SaveChangesAsync(ct);

            if (refund.UserId.HasValue)
            {
                var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(refund.UserId.Value, NotificationTypes.RefundReconciled,
                    "Chủ sân đã xác nhận nhận tiền",
                    $"Đơn #{code}: Chủ sân đã xác nhận nhận được chuyển khoản. Hoàn tiền đang xử lý.",
                    new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                    sendEmail: false, cancellationToken: ct);
            }

            return new RefundActionResult { Message = "Đã xác nhận nhận tiền. Đơn chuyển sang chờ hoàn tiền.", Status = "PENDING_REFUND" };
        }

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Vui lòng nhập lý do từ chối để người chơi được biết.");

        refund.Status = "REJECTED";
        refund.RejectionReason = reason.Trim();
        refund.ProcessedBy = managerId;
        refund.ProcessedAt = DateTime.UtcNow;
        refund.Booking!.Status = "CANCELLED";

        foreach (var item in refund.Booking.BookingItems)
            item.Status = "CANCELLED";
        foreach (var p in refund.Booking.Payments.Where(p =>
                     p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            p.Status = "CANCELLED";

        await _refundRepository.UpdateAsync(refund, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(ct);

        if (refund.UserId.HasValue)
        {
            var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
            await _notify.NotifyUserAsync(refund.UserId.Value, NotificationTypes.RefundRejected,
                "Yêu cầu hoàn tiền bị từ chối",
                $"Đơn #{code}: {refund.RejectionReason}",
                new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                sendEmail: false, cancellationToken: ct);
        }

        return new RefundActionResult { Message = "Đã từ chối. Đơn chuyển sang Đã hủy.", Status = "REJECTED" };
    }

    public async Task<RefundActionResult> CompleteRefundAsync(
        Guid refundId, Guid managerId, string? managerNote, CancellationToken ct)
    {
        var refund = await _refundRepository.GetByIdForManagerAsync(refundId, ct);
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
            var series = await _bookingRepository.GetSeriesByIdAsync(sid, ct);
            if (series != null)
            {
                series.Status = "REFUNDED";
                await _bookingRepository.UpdateSeriesAsync(series, saveChanges: false);
            }
        }

        await _refundRepository.UpdateAsync(refund, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(ct);

        if (refund.UserId.HasValue)
        {
            var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
            await _notify.NotifyUserAsync(refund.UserId.Value, NotificationTypes.RefundCompleted,
                "Hoàn tiền thành công",
                $"Đơn #{code}: Chủ sân đã chuyển khoản hoàn tiền {(refund.RequestedAmount ?? 0).ToString("N0")} ₫. Vui lòng kiểm tra tài khoản.",
                new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                sendEmail: true, cancellationToken: ct);
        }

        return new RefundActionResult { Message = "Đã hoàn tất hoàn tiền.", Status = "COMPLETED" };
    }

    public async Task UploadEvidenceAsync(Guid refundId, Guid managerId, Guid fileEntityId, CancellationToken ct)
    {
        var refund = await _refundRepository.GetByIdForManagerAsync(refundId, ct);
        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();

        refund.ManagerEvidenceFileId = fileEntityId;
        await _refundRepository.UpdateAsync(refund);
    }

    public async Task<List<ManagerRefundListItemDto>> GetRefundRequestsAsync(Guid managerId, string? status, CancellationToken ct)
    {
        var venueIds = await _venueRepository.GetVenueIdsByOwnerAsync(managerId);
        if (venueIds.Count == 0)
            return new List<ManagerRefundListItemDto>();

        var list = await _refundRepository.GetByVenueIdsAsync(venueIds, status, ct);

        return list.Select(r =>
        {
            var b = r.Booking!;
            var code = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var lastPay = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            return new ManagerRefundListItemDto
            {
                RefundRequestId = r.Id,
                BookingId = b.Id,
                BookingCode = code,
                BookingStatus = b.Status,
                VenueName = b.Venue?.Name,
                PlayerName = r.User?.FullName,
                PlayerPhone = b.ContactPhone ?? r.User?.PhoneNumber,
                RefundStatus = r.Status,
                ReasonCode = r.ReasonCode,
                RequestedAmount = r.RequestedAmount,
                PaidAmount = r.PaidAmount,
                FinalAmount = b.FinalAmount ?? b.TotalAmount,
                RefundBankName = r.RefundBankName,
                RefundAccountNumber = r.RefundAccountNumber,
                RefundAccountHolder = r.RefundAccountHolder,
                RefundQrImageUrl = r.RefundQrImageUrl,
                PlayerNote = r.PlayerNote,
                RejectionReason = r.RejectionReason,
                ManagerNote = r.ManagerNote,
                ManagerEvidenceUrl = r.ManagerEvidenceFile?.FileUrl,
                PaymentProofUrl = lastPay?.GatewayReference,
                RequestedAt = r.RequestedAt,
                ProcessedAt = r.ProcessedAt,
            };
        }).ToList();
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

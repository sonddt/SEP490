using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class ManagerBookingService : IManagerBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IRefundRepository _refundRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;

    public ManagerBookingService(
        IBookingRepository bookingRepository,
        IRefundRepository refundRepository,
        IUnitOfWork unitOfWork,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle)
    {
        _bookingRepository = bookingRepository;
        _refundRepository = refundRepository;
        _unitOfWork = unitOfWork;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
    }

    public async Task<List<ManagerBookingListItemDto>> GetBookingsAsync(Guid managerId, string? status, CancellationToken ct)
    {
        var list = await _bookingRepository.GetManagerBookingsAsync(managerId, status, ct);

        // Batch-fetch refund info cho các booking REFUNDED/PENDING_REFUND
        var refundStatuses = new[] { "REFUNDED", "PENDING_REFUND", "PENDING_RECONCILIATION" };
        var refundBookingIds = list.Where(b => refundStatuses.Contains(b.Status)).Select(b => b.Id).ToList();
        var refundMap = refundBookingIds.Any()
            ? await _refundRepository.GetLatestByBookingIdsAsync(refundBookingIds)
            : new Dictionary<Guid, DAL.Models.RefundRequest>();

        return list.Select(b =>
        {
            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var payment = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            var paymentStatus = payment?.Status?.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true ? "PAID" : "UNPAID";
            var refundReq = b.RefundRequests.OrderByDescending(r => r.RequestedAt).FirstOrDefault();

            refundMap.TryGetValue(b.Id, out var refund);

            return new ManagerBookingListItemDto
            {
                BookingId = b.Id,
                BookingCode = bookingCode,
                Status = b.Status,
                SeriesId = b.SeriesId,
                IsLongTerm = b.SeriesId != null,
                ContactName = b.ContactName,
                ContactPhone = b.ContactPhone,
                GuestNote = b.GuestNote,
                ManagerStatusNote = b.ManagerStatusNote,
                TotalAmount = b.FinalAmount ?? b.TotalAmount,
                VenueName = b.Venue?.Name,
                VenueAddress = b.Venue?.Address,
                VenueImageUrl = b.Venue?.Files?.Where(f => f.FileName != null && f.FileName.Contains("mac_dinh")).Select(f => f.FileUrl).FirstOrDefault() ?? b.Venue?.Files?.OrderByDescending(f => f.CreatedAt).Select(f => f.FileUrl).FirstOrDefault(),
                PlayerName = b.User?.FullName,
                PlayerPhone = b.ContactPhone ?? b.User?.PhoneNumber,
                PlayerAvatarUrl = b.User?.AvatarFile?.FileUrl,
                PaymentStatus = paymentStatus,
                PaymentMethod = payment?.Method,
                ProofUrl = payment?.GatewayReference,
                RefundStatus = refundReq?.Status,
                RefundAmount = refundReq?.RequestedAmount,
                PaidAmount = refundReq?.PaidAmount ?? payment?.Amount,
                CreatedAt = b.CreatedAt,
                RefundedAmount = refund?.RequestedAmount ?? 0m,
                PaidAmount = refund?.PaidAmount ?? 0m,
                PenaltyAmount = refund != null ? (refund.PaidAmount ?? 0m) - (refund.RequestedAmount ?? 0m) : 0m,
                Items = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi =>
                {
                    var court = bi.Court;
                    return new ManagerBookingItemDto
                    {
                        CourtName = court?.Name,
                        CourtImageUrl = court?.Files?.FirstOrDefault()?.FileUrl,
                        StartTime = bi.StartTime,
                        EndTime = bi.EndTime,
                    };
                }).ToList(),
            };
        }).ToList();
    }

    public async Task<ManagerBookingPatchResult> PatchStatusAsync(
        Guid bookingId, Guid managerId, string status, string? reason, CancellationToken ct)
    {
        var next = status.Trim().ToUpperInvariant();
        if (next is not ("CONFIRMED" or "CANCELLED"))
            throw new ArgumentException("Trạng thái không hợp lệ (CONFIRMED | CANCELLED).");

        var booking = await _bookingRepository.GetByIdForManagerPatchAsync(bookingId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");
        if (booking.Venue?.OwnerUserId != managerId)
            throw new UnauthorizedAccessException();
        if (booking.Status == "CANCELLED")
            throw new ArgumentException("Đơn đã bị huỷ.");

        var vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTimeZone);
        var firstStartTime = booking.BookingItems.Any() ? booking.BookingItems.Min(bi => bi.StartTime) : DateTime.MaxValue;

        if (booking.Status == "PENDING" && firstStartTime <= nowVn)
            throw new ArgumentException("Đơn đặt đã quá giờ bắt đầu thi đấu nhưng chưa được duyệt. Hệ thống sẽ tự động huỷ và xử lý hoàn tiền cho người chơi.");

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
            if (booking.Status is not ("PENDING" or "CONFIRMED"))
                throw new ArgumentException("Không thể huỷ đơn ở trạng thái này. Đơn đã hoàn thành hoặc đã xử lý.");

            booking.ManagerStatusNote = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();

            var hasConfirmedPayment = booking.Payments.Any(p =>
                p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase));
            var paidAmount = booking.Payments
                .Where(p => p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount ?? 0);

            if (hasConfirmedPayment && paidAmount > 0)
            {
                // Case 4: Manager cancels a CONFIRMED booking with confirmed payments
                booking.Status = "PENDING_REFUND";
                await _refundRepository.AddAsync(new RefundRequest
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    UserId = booking.UserId,
                    ReasonCode = "MANAGER_CANCEL",
                    Status = "PENDING_REFUND",
                    RequestedAmount = paidAmount,
                    PaidAmount = paidAmount,
                    PlayerNote = reason?.Trim(),
                    RequestedAt = DateTime.UtcNow,
                }, saveChanges: false);
            }
            else if (booking.Status == "PENDING" && HasHttpsPaymentProof(booking.Payments))
            {
                // Case 3: Manager rejects PENDING booking but player uploaded payment proof
                // → route through reconciliation so manager can verify the transfer
                var proofAmount = booking.Payments
                    .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
                    .Sum(p => p.Amount ?? 0);

                booking.Status = "PENDING_RECONCILIATION";
                await _refundRepository.AddAsync(new RefundRequest
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    UserId = booking.UserId,
                    ReasonCode = "MANAGER_REJECT",
                    Status = "PENDING_RECONCILIATION",
                    RequestedAmount = proofAmount > 0 ? proofAmount : (booking.FinalAmount ?? booking.TotalAmount),
                    PlayerNote = reason?.Trim(),
                    RequestedAt = DateTime.UtcNow,
                }, saveChanges: false);
            }
            else
            {
                booking.Status = "CANCELLED";
            }

            foreach (var item in booking.BookingItems)
                item.Status = (booking.Status is "CANCELLED" or "PENDING_REFUND" or "PENDING_RECONCILIATION") ? "CANCELLED" : item.Status;
            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = booking.Status == "CANCELLED" ? "CANCELLED" : p.Status;
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _bookingRepository.GetSeriesByIdAsync(seriesId, ct);
            if (series != null)
                series.Status = next == "CONFIRMED" ? "ACTIVE" : (booking.Status == "CANCELLED" ? "CANCELLED" : "CANCELLING");
        }

        await _bookingRepository.UpdateAsync(booking, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(ct);

        if (next == "CANCELLED")
            await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "chủ sân", ct);

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        if (booking.UserId is { } playerId)
        {
            var venueName = booking.Venue?.Name ?? "sân";
            var reasonText = string.IsNullOrWhiteSpace(booking.ManagerStatusNote)
                ? "Đơn đã bị huỷ/từ chối."
                : booking.ManagerStatusNote;

            string title, body;
            if (next == "CONFIRMED")
            {
                title = "Đơn đặt sân đã được duyệt";
                body = $"Mã #{code} tại {venueName} đã được chủ sân xác nhận.";
            }
            else if (booking.Status == "PENDING_RECONCILIATION")
            {
                title = "Đơn đặt sân bị huỷ — đang chờ đối soát";
                body = $"Mã #{code} tại {venueName} đã bị huỷ (Lý do: {reasonText}). Chủ sân đang đối soát giao dịch để hoàn tiền cho bạn.";
            }
            else if (booking.Status == "PENDING_REFUND")
            {
                title = "Đơn đặt sân bị huỷ — đang xử lý hoàn tiền";
                body = $"Mã #{code} tại {venueName} đã bị huỷ (Lý do: {reasonText}). Chủ sân đang xử lý yêu cầu hoàn tiền của bạn.";
            }
            else
            {
                title = "Đơn đặt sân đã bị huỷ";
                body = $"Mã #{code} tại {venueName} đã bị huỷ bởi chủ sân. Lý do: {reasonText}";
            }

            await _notify.NotifyUserAsync(playerId, NotificationTypes.Booking, title, body,
                new { bookingId = booking.Id, status = booking.Status, entityType = "booking", deepLink = $"/user/bookings?bookingId={booking.Id}" },
                sendEmail: true, cancellationToken: ct);
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

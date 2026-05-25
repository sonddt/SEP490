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

        return list.Select(b =>
        {
            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var payment = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            var paymentStatus = payment?.Status?.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true ? "PAID" : "UNPAID";

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
                PlayerName = b.User?.FullName,
                PlayerPhone = b.ContactPhone ?? b.User?.PhoneNumber,
                PlayerAvatarUrl = b.User?.AvatarFile?.FileUrl,
                PaymentStatus = paymentStatus,
                PaymentMethod = payment?.Method,
                ProofUrl = payment?.GatewayReference,
                CreatedAt = b.CreatedAt,
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
                await _refundRepository.AddAsync(new RefundRequest
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    UserId = booking.UserId,
                    ReasonCode = "MANAGER_CANCEL",
                    Status = "PENDING_REFUND",
                    RequestedAmount = paidAmount,
                    PaidAmount = paidAmount,
                    RequestedAt = DateTime.UtcNow,
                }, saveChanges: false);
            }
            else
            {
                booking.Status = "CANCELLED";
            }

            foreach (var item in booking.BookingItems)
                item.Status = booking.Status == "CANCELLED" ? "CANCELLED" : item.Status;
            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _bookingRepository.GetSeriesByIdAsync(seriesId, ct);
            if (series != null)
                series.Status = next == "CONFIRMED" ? "ACTIVE" : "CANCELLED";
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
            var title = next == "CONFIRMED" ? "Đơn đặt sân đã được duyệt" : "Đơn đặt sân đã bị huỷ";
            var body = next == "CONFIRMED"
                ? $"Mã #{code} tại {venueName} đã được chủ sân xác nhận."
                : $"Mã #{code} tại {venueName} đã bị huỷ bởi chủ sân. Lý do: {reasonText}";

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

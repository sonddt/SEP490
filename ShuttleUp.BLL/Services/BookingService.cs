using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.DTOs.Policy;
using ShuttleUp.BLL.Helpers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class BookingService : IBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IRefundRepository _refundRepository;
    private readonly IVenueCouponRepository _couponRepository;
    private readonly IVenueRepository _venueRepository;
    private readonly IVenueReviewRepository _reviewRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;

    public BookingService(
        IBookingRepository bookingRepository,
        IRefundRepository refundRepository,
        IVenueCouponRepository couponRepository,
        IVenueRepository venueRepository,
        IVenueReviewRepository reviewRepository,
        IUnitOfWork unitOfWork,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        IMemoryCache cache)
    {
        _bookingRepository = bookingRepository;
        _refundRepository = refundRepository;
        _couponRepository = couponRepository;
        _venueRepository = venueRepository;
        _reviewRepository = reviewRepository;
        _unitOfWork = unitOfWork;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _cache = cache;
    }

    public Task<Booking?> GetByIdAsync(Guid id) => _bookingRepository.GetByIdAsync(id);
    public Task<IEnumerable<Booking>> GetAllAsync() => _bookingRepository.GetAllAsync();
    public Task<IEnumerable<Booking>> GetByUserAsync(Guid userId) => _bookingRepository.GetByUserAsync(userId);
    public Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId) => _bookingRepository.GetByVenueAsync(venueId);
    public Task<IEnumerable<Booking>> GetByStatusAsync(string status) => _bookingRepository.GetByStatusAsync(status);

    public async Task CreateAsync(Booking booking)
    {
        booking.Id = Guid.NewGuid();
        booking.CreatedAt = DateTime.UtcNow;
        booking.Status = "PENDING";
        await _bookingRepository.AddAsync(booking);
    }

    public Task UpdateAsync(Booking booking) => _bookingRepository.UpdateAsync(booking);

    public async Task CancelAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CANCELLED";
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task ConfirmAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CONFIRMED";
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task<BookingResponseDto> CancelHoldAsync(Guid bookingId, Guid userId, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithItemsAndCourtsAsync(bookingId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");
        if (booking.UserId != userId)
            throw new UnauthorizedAccessException();
        if (booking.Status != "HOLDING")
            throw new ArgumentException("Chỉ có thể huỷ đơn đang giữ chỗ (HOLDING).");

        booking.Status = "CANCELLED";
        booking.HoldExpiresAt = null;
        foreach (var item in booking.BookingItems)
            item.Status = "CANCELLED";

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _bookingRepository.GetSeriesByIdAsync(seriesId, ct);
            if (series != null)
            {
                series.Status = "CANCELLED";
                await _bookingRepository.UpdateSeriesAsync(series, saveChanges: false);
            }
        }

        if (booking.CouponId.HasValue)
        {
            var coupon = await _couponRepository.GetByIdAsync(booking.CouponId.Value);
            if (coupon != null && (coupon.UsedCount ?? 0) > 0)
            {
                coupon.UsedCount = (coupon.UsedCount ?? 0) - 1;
                await _couponRepository.UpdateAsync(coupon, saveChanges: false);
            }
        }

        await _bookingRepository.UpdateAsync(booking, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(ct);

        return new BookingResponseDto { BookingId = booking.Id, Status = booking.Status };
    }

    public async Task<(string Message, string Status, string CancelBranch, Guid? RefundRequestId)> CancelMyBookingAsync(
        Guid bookingId, Guid userId, CancelBookingBodyDto? body, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithItemsPaymentsForCancelTrackedAsync(bookingId, userId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.Status is "CANCELLED" or "PENDING_RECONCILIATION" or "PENDING_REFUND" or "REFUNDED")
            throw new ArgumentException("Đơn đã bị huỷ hoặc đang xử lý hoàn tiền.");
        if (booking.Status is not ("PENDING" or "CONFIRMED"))
            throw new ArgumentException("Không thể huỷ đơn ở trạng thái này.");

        var policy = ParsePolicyOrDefault(booking.CancellationPolicySnapshotJson);
        if (!policy.AllowCancel)
            throw new ArgumentException("Theo chính sách cụm sân, bạn không thể tự huỷ đơn này. Vui lòng liên hệ chủ sân.");

        var starts = booking.BookingItems.Where(bi => bi.StartTime != null).Select(bi => bi.StartTime!.Value).ToList();
        if (starts.Count > 0)
        {
            var minStartUtc = starts.Select(ToUtcComparable).Min();
            if (DateTime.UtcNow > minStartUtc.AddMinutes(-policy.CancelBeforeMinutes))
                throw new ArgumentException($"Đã quá thời hạn huỷ (phải huỷ trước giờ đá ít nhất {policy.CancelBeforeMinutes} phút).");
        }

        var (hasProof, paymentConfirmed, paidAmount) = AnalyzePaymentState(booking.Payments);
        string cancelBranch;
        string newBookingStatus;
        string? refundRequestStatus = null;

        if (paymentConfirmed)
        {
            cancelBranch = "PAID";
            newBookingStatus = "PENDING_REFUND";
            refundRequestStatus = "PENDING_REFUND";
        }
        else if (hasProof)
        {
            cancelBranch = "PROOF_UPLOADED";
            newBookingStatus = "PENDING_RECONCILIATION";
            refundRequestStatus = "PENDING_RECONCILIATION";
        }
        else
        {
            cancelBranch = "NO_PAYMENT";
            newBookingStatus = "CANCELLED";
        }

        booking.Status = newBookingStatus;
        foreach (var item in booking.BookingItems)
            item.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : item.Status;

        if (newBookingStatus == "CANCELLED")
        {
            foreach (var p in booking.Payments.Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _bookingRepository.GetSeriesByIdAsync(seriesId, ct);
            if (series != null)
                series.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : "CANCELLING";
        }

        RefundRequest? refundReq = null;
        if (refundRequestStatus != null)
        {
            decimal refundAmount = 0;
            if (cancelBranch == "PAID")
                refundAmount = policy.ComputeRefundAmount(paidAmount);
            else if (cancelBranch == "PROOF_UPLOADED")
                refundAmount = SumPendingPaymentAmount(booking.Payments);

            refundReq = new RefundRequest
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                UserId = userId,
                ReasonCode = "PLAYER_CANCEL",
                Status = refundRequestStatus,
                RequestedAmount = refundAmount,
                PaidAmount = cancelBranch == "PAID" ? paidAmount : (cancelBranch == "PROOF_UPLOADED" ? refundAmount : null),
                RefundBankName = body?.RefundBankName?.Trim(),
                RefundAccountNumber = body?.RefundAccountNumber?.Trim(),
                RefundAccountHolder = body?.RefundAccountHolder?.Trim().ToUpperInvariant(),
                RefundQrImageUrl = body?.RefundQrImageUrl?.Trim(),
                PlayerNote = body?.PlayerNote?.Trim(),
                RequestedAt = DateTime.UtcNow,
            };
        }

        await using var trx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            if (refundReq != null)
                await _refundRepository.AddAsync(refundReq, saveChanges: false);
            await _bookingRepository.UpdateAsync(booking, saveChanges: false);
            await _unitOfWork.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        }
        catch
        {
            await trx.RollbackAsync(ct);
            throw;
        }

        await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "người chơi", ct);

        if (booking.VenueId.HasValue)
        {
            var ownerId = await _bookingRepository.GetVenueOwnerIdAsync(booking.VenueId.Value, ct);
            if (ownerId.HasValue)
            {
                var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
                var title = cancelBranch switch
                {
                    "PAID" => "Yêu cầu hoàn tiền mới",
                    "PROOF_UPLOADED" => "Đơn hủy cần đối soát",
                    _ => "Đơn đặt sân bị hủy",
                };
                var notifBody = $"Đơn #{code} đã bị người chơi hủy" + cancelBranch switch
                {
                    "PAID" => " — vui lòng xử lý hoàn tiền.",
                    "PROOF_UPLOADED" => " — có chứng từ CK cần đối soát.",
                    _ => ".",
                };
                await _notify.NotifyUserAsync(ownerId.Value, NotificationTypes.RefundRequest, title, notifBody,
                    new { bookingId = booking.Id, status = newBookingStatus, entityType = "refund", deepLink = "/manager/refunds" },
                    sendEmail: false, cancellationToken: ct);
            }
        }

        var message = cancelBranch switch
        {
            "PAID" => "Đã hủy đơn. Yêu cầu hoàn tiền đã được gửi đến chủ sân.",
            "PROOF_UPLOADED" => "Đã hủy đơn. Vui lòng chờ chủ sân đối soát biên lai trước khi xử lý hoàn tiền.",
            _ => "Đã huỷ đặt sân thành công.",
        };

        return (message, newBookingStatus, cancelBranch, refundReq?.Id);
    }

    public async Task UpdateRefundBankInfoAsync(Guid bookingId, Guid userId, CancelBookingBodyDto body, CancellationToken ct)
    {
        var refund = await _refundRepository.GetActiveByBookingAndUserAsync(bookingId, userId, ct);
        if (refund == null)
            throw new KeyNotFoundException("Không tìm thấy yêu cầu hoàn tiền.");

        if (!string.IsNullOrWhiteSpace(body.RefundBankName))
            refund.RefundBankName = body.RefundBankName.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountNumber))
            refund.RefundAccountNumber = body.RefundAccountNumber.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountHolder))
            refund.RefundAccountHolder = body.RefundAccountHolder.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(body.RefundQrImageUrl))
            refund.RefundQrImageUrl = body.RefundQrImageUrl.Trim();

        await _refundRepository.UpdateAsync(refund);
    }

    public async Task SubmitPaymentAsync(Guid bookingId, Guid userId, string method, string secureUrl, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithVenueOwnerPaymentsAsync(bookingId, userId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");
        if (booking.Status == "CANCELLED")
            throw new ArgumentException("Đơn đã bị huỷ.");
        if (booking.Status is not ("PENDING" or "HOLDING"))
            throw new ArgumentException("Chỉ có thể nộp minh chứng khi đơn đang chờ duyệt hoặc đang giữ chỗ.");
        if (booking.Status == "HOLDING" && booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            throw new ArgumentException("Thời gian giữ chỗ đã hết. Vui lòng đặt lại.");

        var methodNorm = string.IsNullOrWhiteSpace(method) ? "BANK" : method.Trim().ToUpperInvariant();
        var methodLabel = methodNorm == "QR" ? "QR" : "BANK_TRANSFER";

        var existingPending = booking.Payments
            .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        if (existingPending != null
            && !string.IsNullOrEmpty(existingPending.GatewayReference)
            && existingPending.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Đơn đã có minh chứng thanh toán. Không gửi lại.");

        var wasHolding = booking.Status == "HOLDING";
        if (wasHolding)
        {
            booking.Status = "PENDING";
            booking.HoldExpiresAt = null;
            foreach (var item in booking.BookingItems)
                item.Status = "PENDING";

            if (booking.SeriesId is { } seriesId)
            {
                var series = await _bookingRepository.GetSeriesByIdAsync(seriesId, ct);
                if (series != null) series.Status = "PENDING";
            }
        }

        if (existingPending != null)
        {
            existingPending.Method = methodLabel;
            existingPending.GatewayReference = secureUrl;
            existingPending.Amount = booking.FinalAmount;
            existingPending.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            await _bookingRepository.AddPaymentAsync(new Payment
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                Method = methodLabel,
                Status = "PENDING",
                Amount = booking.FinalAmount,
                GatewayReference = secureUrl,
                CreatedAt = DateTime.UtcNow,
            }, saveChanges: false);
        }

        await _bookingRepository.UpdateAsync(booking, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(ct);

        if (booking.Venue?.OwnerUserId is { } mgrId && mgrId != Guid.Empty)
            QueueManagerPaymentNotification(booking, wasHolding, mgrId);
    }

    public async Task<List<MyBookingListItemDto>> GetMyBookingsAsync(Guid userId, CancellationToken ct)
    {
        var rows = await _bookingRepository.GetMyBookingsRawAsync(userId, ct);
        var bookingIds = rows.Select(r => r.Id).ToList();
        var nowUtc = DateTime.UtcNow;
        var reviewByBookingId = await _reviewRepository.GetReviewIdsByUserBookingsAsync(userId, bookingIds, ct);
        var refunds = await _refundRepository.GetLatestByBookingIdsAsync(bookingIds, ct);

        return rows.Select(b =>
        {
            refunds.TryGetValue(b.Id, out var refund);
            var created = b.CreatedAt ?? nowUtc;
            var windowEnd = created.AddDays(3);
            var inWindow = nowUtc <= windowEnd;
            var isConfirmed = string.Equals(b.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase);
            var venueReviewId = reviewByBookingId.TryGetValue(b.Id, out var vrId) ? vrId : (Guid?)null;
            var hasProof = b.Payments.Any(p =>
                p.GatewayReference != null && p.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase));

            return new MyBookingListItemDto
            {
                Id = b.Id,
                BookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant(),
                Status = b.Status,
                ManagerStatusNote = b.ManagerStatusNote,
                TotalAmount = b.TotalAmount,
                FinalAmount = b.FinalAmount,
                CreatedAt = b.CreatedAt,
                SeriesId = b.SeriesId,
                IsLongTerm = b.SeriesId != null,
                VenueName = b.Venue?.Name,
                VenueAddress = b.Venue?.Address,
                VenueId = b.VenueId,
                VenueImageUrl = b.Venue?.Files?.Where(f => f.FileName != null && f.FileName.Contains("mac_dinh")).Select(f => f.FileUrl).FirstOrDefault()
                               ?? b.Venue?.Files?.OrderByDescending(f => f.CreatedAt).Select(f => f.FileUrl).FirstOrDefault(),
                LastPaymentMethod = b.Payments.OrderByDescending(p => p.CreatedAt).Select(p => p.Method).FirstOrDefault(),
                PaymentProofUrl = b.Payments
                    .OrderByDescending(p => p.CreatedAt)
                    .Where(p => p.GatewayReference != null && p.GatewayReference.StartsWith("https"))
                    .Select(p => p.GatewayReference)
                    .FirstOrDefault(),
                HasValidPaymentProof = hasProof,
                NeedsPaymentRetry = b.Status == "PENDING" && !hasProof,
                Items = b.BookingItems.Select(bi => new MyBookingItemDto
                {
                    Id = bi.Id,
                    CourtId = bi.CourtId,
                    CourtName = bi.Court?.Name,
                    StartTime = bi.StartTime,
                    EndTime = bi.EndTime,
                    FinalPrice = bi.FinalPrice,
                    Status = bi.Status,
                }).ToList(),
                RefundStatus = refund?.Status,
                RefundAmount = refund?.RequestedAmount,
                RefundBankName = refund?.RefundBankName,
                RefundAccountNumber = refund?.RefundAccountNumber,
                RefundAccountHolder = refund?.RefundAccountHolder,
                RefundQrImageUrl = refund?.RefundQrImageUrl,
                RefundManagerEvidenceUrl = refund?.ManagerEvidenceFile?.FileUrl,
                RefundRejectionReason = refund?.RejectionReason,
                VenueReviewId = venueReviewId,
                ReviewWindowEndsAt = windowEnd,
                CanReview = isConfirmed && inWindow && venueReviewId == null,
                CanEditReview = isConfirmed && inWindow && venueReviewId != null,
            };
        }).ToList();
    }

    public async Task<CancelPreviewDto> GetCancelPreviewAsync(Guid bookingId, Guid userId, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithItemsPaymentsForCancelAsync(bookingId, userId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        var policy = ParsePolicyOrDefault(booking.CancellationPolicySnapshotJson);
        var (hasProof, paymentConfirmed, paidAmount) = AnalyzePaymentState(booking.Payments);
        var pendingPaymentAmount = SumPendingPaymentAmount(booking.Payments);
        var finalAmount = booking.FinalAmount ?? booking.TotalAmount ?? 0;

        var starts = booking.BookingItems.Where(bi => bi.StartTime != null).Select(bi => bi.StartTime!.Value).ToList();
        var minStart = starts.Count > 0 ? starts.Select(ToUtcComparable).Min() : (DateTime?)null;
        var withinDeadline = minStart == null || DateTime.UtcNow <= minStart.Value.AddMinutes(-policy.CancelBeforeMinutes);

        var cancelBranch = paymentConfirmed ? "PAID" : hasProof ? "PROOF_UPLOADED" : "NO_PAYMENT";

        decimal refundAmount = 0;
        decimal penaltyAmount = 0;
        string? refundEstimateNote = null;

        if (withinDeadline && policy.AllowCancel)
        {
            if (cancelBranch == "PAID")
            {
                refundAmount = policy.ComputeRefundAmount(paidAmount);
                penaltyAmount = paidAmount - refundAmount;
            }
            else if (cancelBranch == "PROOF_UPLOADED")
            {
                refundAmount = pendingPaymentAmount;
                penaltyAmount = 0;
                refundEstimateNote = "Chủ sân chưa xác nhận sân → hoàn 100% số tiền đã chuyển.";
            }
        }

        return new CancelPreviewDto
        {
            BookingId = booking.Id,
            BookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant(),
            BookingStatus = booking.Status,
            VenueName = booking.Venue?.Name,
            IsLongTerm = booking.SeriesId != null,
            CancelBranch = cancelBranch,
            CanCancel = policy.AllowCancel && withinDeadline && booking.Status is "PENDING" or "CONFIRMED",
            DisableReason = !policy.AllowCancel
                ? "Sân này không cho phép hủy trên app."
                : !withinDeadline
                    ? $"Đã quá hạn hủy (phải hủy trước {policy.CancelBeforeMinutes} phút)."
                    : booking.Status is not ("PENDING" or "CONFIRMED")
                        ? "Đơn không ở trạng thái có thể hủy."
                        : null,
            Policy = new CancelPreviewPolicyDto
            {
                AllowCancel = policy.AllowCancel,
                CancelBeforeMinutes = policy.CancelBeforeMinutes,
                RefundType = policy.RefundType,
                RefundPercent = policy.RefundPercent.HasValue ? (int?)Math.Round(policy.RefundPercent.Value) : null,
            },
            Payment = new CancelPreviewPaymentDto
            {
                HasProof = hasProof,
                PaymentConfirmed = paymentConfirmed,
                PaidAmount = paidAmount,
                PendingPaymentAmount = pendingPaymentAmount,
                FinalAmount = finalAmount,
            },
            Refund = new CancelPreviewRefundDto
            {
                RefundAmount = refundAmount,
                PenaltyAmount = penaltyAmount,
                RefundEstimateNote = refundEstimateNote,
                PolicyDescription = policy.RefundType switch
                {
                    "FULL" => $"Hủy trước {policy.CancelBeforeMinutes} phút → hoàn 100%.",
                    "PERCENT" when policy.RefundPercent.HasValue =>
                        $"Hủy trước {policy.CancelBeforeMinutes} phút → hoàn {policy.RefundPercent}%.",
                    _ => "Sân này không hỗ trợ hoàn tiền khi hủy.",
                },
            },
        };
    }

    public async Task<PaymentContextDto> GetPaymentContextAsync(Guid bookingId, Guid userId, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithItemsPaymentsVenueForPaymentAsync(bookingId, userId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");
        if (booking.Status is not ("PENDING" or "HOLDING"))
            throw new ArgumentException("Chỉ có thể thanh toán khi đơn đang chờ duyệt hoặc đang giữ chỗ.");
        if (booking.Status == "HOLDING" && booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            throw new ArgumentException("Thời gian giữ chỗ đã hết. Vui lòng đặt lại.");

        var lastPay = booking.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
        var hasProof = lastPay != null
            && !string.IsNullOrEmpty(lastPay.GatewayReference)
            && lastPay.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase);

        var venueSlotDuration = booking.Venue?.SlotDuration ?? 60;
        var totalMins = booking.BookingItems.Count * venueSlotDuration;
        var th = totalMins / 60;
        var tm = totalMins % 60;

        return new PaymentContextDto
        {
            BookingId = booking.Id,
            BookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant(),
            Status = booking.Status,
            HoldExpiresAt = booking.HoldExpiresAt.HasValue
                ? DateTime.SpecifyKind(booking.HoldExpiresAt.Value, DateTimeKind.Utc)
                : null,
            VenueId = booking.VenueId,
            VenueName = booking.Venue?.Name,
            VenueAddress = booking.Venue?.Address,
            Date = booking.BookingItems.Min(bi => bi.StartTime)?.ToString("yyyy-MM-dd"),
            TotalPrice = booking.FinalAmount ?? 0,
            TotalHours = tm > 0 ? $"{th}h{tm}" : $"{th}h",
            SlotDuration = venueSlotDuration,
            CustomerName = booking.ContactName,
            CustomerPhone = booking.ContactPhone,
            Note = booking.GuestNote,
            HasValidPaymentProof = hasProof,
            SelectedSlots = booking.BookingItems.OrderBy(bi => bi.StartTime).Select(bi => new PaymentContextSlotDto
            {
                CourtId = bi.CourtId,
                CourtName = bi.Court?.Name,
                StartTime = bi.StartTime,
                EndTime = bi.EndTime,
                Price = bi.FinalPrice ?? 0,
            }).ToList(),
        };
    }

    public async Task<PreviewDiscountResultDto> PreviewDiscountAsync(PreviewDiscountDto dto, Guid? userId, CancellationToken ct)
    {
        if (dto.BaseAmount <= 0)
            throw new ArgumentException("BaseAmount phải lớn hơn 0.");

        var bookedDates = new List<DateTime>();
        if (dto.BookedDates is { Count: > 0 })
        {
            foreach (var ds in dto.BookedDates)
            {
                if (DateTime.TryParse(ds, out var parsed))
                    bookedDates.Add(parsed);
            }
        }

        if (bookedDates.Count == 0)
        {
            if (dto.DaysDuration < 1) dto.DaysDuration = 1;
            bookedDates.Add(DateTime.UtcNow.Date);
        }

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null)
            throw new KeyNotFoundException("Cơ sở không tồn tại.");

        VenueCoupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
            coupon = await _couponRepository.GetActiveByVenueAndCodeAsync(dto.VenueId, dto.CouponCode.Trim().ToUpperInvariant(), ct);

        var hasUserUsedCoupon = coupon != null && coupon.OneUsePerUser && userId is { } uid && uid != Guid.Empty
            && await _bookingRepository.HasUserUsedCouponAsync(uid, coupon.Id, ct);

        var (discountAmount, finalAmount, couponId, _, errorMsg, longTermDiscountAmount, couponDiscountAmount) =
            DiscountHelper.CalculateDiscount(venue, dto.BaseAmount, bookedDates, dto.CouponCode, coupon, hasUserUsedCoupon);

        return new PreviewDiscountResultDto
        {
            BaseAmount = dto.BaseAmount,
            DiscountAmount = discountAmount,
            LongTermDiscountAmount = longTermDiscountAmount,
            CouponDiscountAmount = couponDiscountAmount,
            FinalAmount = finalAmount,
            IsValidCoupon = couponId != null,
            ErrorMsg = errorMsg,
        };
    }

    public async Task<RemindOwnerResultDto> RemindOwnerAsync(Guid bookingId, Guid userId, int cooldownMinutes, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdWithVenueOwnerForRemindAsync(bookingId, userId, ct);
        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt sân.");
        if (booking.Status != "PENDING")
            throw new ArgumentException("Chỉ có thể nhắc chủ sân khi đơn đang ở trạng thái Chờ duyệt.");

        var owner = booking.Venue?.OwnerUser;
        if (owner == null)
            throw new ArgumentException("Không tìm thấy thông tin chủ sân.");

        var cacheKey = $"SoftReminder_{bookingId}";
        if (_cache.TryGetValue(cacheKey, out DateTime lastSent))
        {
            var remaining = lastSent.AddMinutes(cooldownMinutes) - DateTime.UtcNow;
            if (remaining > TimeSpan.Zero)
            {
                var mins = (int)Math.Ceiling(remaining.TotalMinutes);
                throw new InvalidOperationException($"Bạn đã nhắc chủ sân rồi. Vui lòng chờ thêm {mins} phút nữa.");
            }
        }

        var playerName = booking.User?.FullName ?? booking.ContactName ?? "Khách hàng";
        var venueName = booking.Venue?.Name ?? "sân";
        var bookingCode = booking.Id.ToString()[..8].ToUpper();
        var frontendUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";
        var managerLink = $"{frontendUrl}/manager/bookings";

        var htmlBody = $"""
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Nhắc nhở duyệt đơn đặt sân</p>
              </div>
              <div style="padding:24px">
                <p style="color:#334155;font-size:15px;margin:0 0 16px">
                  Xin chào <strong>{System.Net.WebUtility.HtmlEncode(owner.FullName ?? owner.Email ?? "Chủ sân")}</strong>,
                </p>
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px">
                  <p style="margin:0;color:#92400e;font-size:14px">
                    ⏳ Khách hàng <strong>{System.Net.WebUtility.HtmlEncode(playerName)}</strong>
                    đang chờ bạn duyệt đơn đặt sân <strong>#{bookingCode}</strong>
                    tại <strong>{System.Net.WebUtility.HtmlEncode(venueName)}</strong>.
                  </p>
                </div>
                <div style="text-align:center;margin:20px 0">
                  <a href="{managerLink}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Xem danh sách đơn đặt sân</a>
                </div>
              </div>
            </div>
            """;

        await _notify.NotifyUserAsync(owner.Id, NotificationTypes.BookingManagerReminder,
            "📋 Khách hàng nhắc duyệt đơn đặt sân",
            $"{playerName} đang chờ bạn duyệt đơn #{bookingCode} tại {venueName}. Vui lòng vào hệ thống để xác nhận hoặc từ chối.",
            metadata: new { bookingId = booking.Id, venueId = booking.VenueId },
            sendEmail: true, htmlBodyOverride: htmlBody, cancellationToken: ct);

        _cache.Set(cacheKey, DateTime.UtcNow, TimeSpan.FromMinutes(cooldownMinutes));

        return new RemindOwnerResultDto { Message = "Đã gửi nhắc nhở đến chủ sân thành công!" };
    }

    private void QueueManagerPaymentNotification(Booking booking, bool wasHolding, Guid mgrId)
    {
        var bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        var capturedBookingId = booking.Id;
        var capturedContactName = booking.ContactName;
        var capturedFinalAmount = booking.FinalAmount;
        var capturedOwnerName = booking.Venue?.OwnerUser?.FullName ?? "Chủ sân";
        var capturedVenueName = booking.Venue?.Name ?? "sân";
        var capturedWasHolding = wasHolding;
        var capturedFrontUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var notify = scope.ServiceProvider.GetRequiredService<INotificationDispatchService>();
                var notifTitle = capturedWasHolding ? "📢 Có đơn đặt sân mới chờ duyệt" : "Có minh chứng thanh toán mới";
                var notifBody = capturedWasHolding
                    ? $"Mã {bookingCode} — {capturedContactName} — {capturedFinalAmount:N0} VNĐ."
                    : $"Đơn {bookingCode} vừa có ảnh chứng từ từ người chơi.";

                string? newBookingHtml = null;
                if (capturedWasHolding)
                {
                    var mgrLink = $"{capturedFrontUrl}/manager/bookings";
                    newBookingHtml = $"""
                        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                          <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                            <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Đơn đặt sân mới</p>
                          </div>
                          <div style="padding:24px">
                            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
                              <p style="margin:0;color:#334155;font-size:14px"><strong>📋 Mã đơn:</strong> {bookingCode}</p>
                              <p style="margin:8px 0 0;color:#334155;font-size:14px"><strong>👤 Khách:</strong> {System.Net.WebUtility.HtmlEncode(capturedContactName ?? "Khách hàng")}</p>
                              <p style="margin:8px 0 0;color:#334155;font-size:14px"><strong>💰 Tổng:</strong> {capturedFinalAmount:N0} VNĐ</p>
                            </div>
                            <div style="text-align:center">
                              <a href="{mgrLink}" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 24px;font-size:15px;font-weight:600;border-radius:6px;display:inline-block">Duyệt đơn ngay</a>
                            </div>
                          </div>
                        </div>
                        """;
                }

                await notify.NotifyUserAsync(mgrId,
                    capturedWasHolding ? NotificationTypes.BookingNew : NotificationTypes.PaymentProof,
                    notifTitle, notifBody,
                    new { bookingId = capturedBookingId, status = "PENDING", entityType = "booking", deepLink = "/manager/bookings" },
                    sendEmail: capturedWasHolding, htmlBodyOverride: newBookingHtml);
            }
            catch { }
        });
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

    private static (bool hasProof, bool paymentConfirmed, decimal paidAmount) AnalyzePaymentState(ICollection<Payment> payments)
    {
        var hasProof = payments.Any(p =>
            p.GatewayReference != null
            && p.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase));
        var paymentConfirmed = payments.Any(p =>
            p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase));
        var paidAmount = payments
            .Where(p => p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount ?? 0);
        return (hasProof, paymentConfirmed, paidAmount);
    }

    private static decimal SumPendingPaymentAmount(ICollection<Payment> payments) =>
        payments
            .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount ?? 0);

    private static DateTime ToUtcComparable(DateTime dt) =>
        dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };
}

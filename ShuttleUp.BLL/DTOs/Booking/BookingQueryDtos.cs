namespace ShuttleUp.BLL.DTOs.Booking;

public class MyBookingListItemDto
{
    public Guid Id { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? Status { get; set; }
    public string? ManagerStatusNote { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal? FinalAmount { get; set; }
    public DateTime? CreatedAt { get; set; }
    public Guid? SeriesId { get; set; }
    public bool IsLongTerm { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public Guid? VenueId { get; set; }
    public string? VenueImageUrl { get; set; }
    public string? LastPaymentMethod { get; set; }
    public string? PaymentProofUrl { get; set; }
    public bool HasValidPaymentProof { get; set; }
    public bool NeedsPaymentRetry { get; set; }
    public List<MyBookingItemDto> Items { get; set; } = new();
    public string? RefundStatus { get; set; }
    public decimal? RefundAmount { get; set; }
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountHolder { get; set; }
    public string? RefundQrImageUrl { get; set; }
    public string? RefundManagerEvidenceUrl { get; set; }
    public string? RefundRejectionReason { get; set; }
    public Guid? VenueReviewId { get; set; }
    public DateTime ReviewWindowEndsAt { get; set; }
    public bool CanReview { get; set; }
    public bool CanEditReview { get; set; }
}

public class MyBookingItemDto
{
    public Guid Id { get; set; }
    public Guid? CourtId { get; set; }
    public string? CourtName { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal? FinalPrice { get; set; }
    public string? Status { get; set; }
}

public class CancelPreviewDto
{
    public Guid BookingId { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? BookingStatus { get; set; }
    public string? VenueName { get; set; }
    public bool IsLongTerm { get; set; }
    public string CancelBranch { get; set; } = null!;
    public bool CanCancel { get; set; }
    public string? DisableReason { get; set; }
    public CancelPreviewPolicyDto Policy { get; set; } = new();
    public CancelPreviewPaymentDto Payment { get; set; } = new();
    public CancelPreviewRefundDto Refund { get; set; } = new();
}

public class CancelPreviewPolicyDto
{
    public bool AllowCancel { get; set; }
    public int CancelBeforeMinutes { get; set; }
    public string? RefundType { get; set; }
    public int? RefundPercent { get; set; }
}

public class CancelPreviewPaymentDto
{
    public bool HasProof { get; set; }
    public bool PaymentConfirmed { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal PendingPaymentAmount { get; set; }
    public decimal FinalAmount { get; set; }
}

public class CancelPreviewRefundDto
{
    public decimal RefundAmount { get; set; }
    public decimal PenaltyAmount { get; set; }
    public string? RefundEstimateNote { get; set; }
    public string? PolicyDescription { get; set; }
}

public class PaymentContextDto
{
    public Guid BookingId { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? Status { get; set; }
    public DateTime? HoldExpiresAt { get; set; }
    public Guid? VenueId { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public string? Date { get; set; }
    public decimal TotalPrice { get; set; }
    public string TotalHours { get; set; } = null!;
    public int SlotDuration { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? Note { get; set; }
    public bool HasValidPaymentProof { get; set; }
    public List<PaymentContextSlotDto> SelectedSlots { get; set; } = new();
}

public class PaymentContextSlotDto
{
    public Guid? CourtId { get; set; }
    public string? CourtName { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal Price { get; set; }
}

public class PreviewDiscountResultDto
{
    public decimal BaseAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LongTermDiscountAmount { get; set; }
    public decimal CouponDiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public bool IsValidCoupon { get; set; }
    public string? ErrorMsg { get; set; }
}

public class RemindOwnerResultDto
{
    public string Message { get; set; } = null!;
}

public class ManagerBookingListItemDto
{
    public Guid BookingId { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? Status { get; set; }
    public Guid? SeriesId { get; set; }
    public bool IsLongTerm { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? GuestNote { get; set; }
    public string? ManagerStatusNote { get; set; }
    public decimal? TotalAmount { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public string? PlayerName { get; set; }
    public string? PlayerPhone { get; set; }
    public string? PlayerAvatarUrl { get; set; }
    public string PaymentStatus { get; set; } = null!;
    public string? PaymentMethod { get; set; }
    public string? ProofUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
    public List<ManagerBookingItemDto> Items { get; set; } = new();
}

public class ManagerBookingItemDto
{
    public string? CourtName { get; set; }
    public string? CourtImageUrl { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class ManagerRefundListItemDto
{
    public Guid RefundRequestId { get; set; }
    public Guid BookingId { get; set; }
    public string BookingCode { get; set; } = null!;
    public string? BookingStatus { get; set; }
    public string? VenueName { get; set; }
    public string? CourtName { get; set; }
    public DateTime? BookingDate { get; set; }
    public DateTime? BookingTime { get; set; }
    public bool IsLongTerm { get; set; }
    public List<ManagerRefundBookingItemDto>? BookingItems { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PlayerName { get; set; }
    public string? PlayerPhone { get; set; }
    public string? RefundStatus { get; set; }
    public string? ReasonCode { get; set; }
    public decimal? RequestedAmount { get; set; }
    public decimal? PaidAmount { get; set; }
    public decimal? FinalAmount { get; set; }
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountHolder { get; set; }
    public string? RefundQrImageUrl { get; set; }
    public string? PlayerNote { get; set; }
    public string? RejectionReason { get; set; }
    public string? ManagerNote { get; set; }
    public string? ManagerEvidenceUrl { get; set; }
    public string? PaymentProofUrl { get; set; }
    public DateTime? RequestedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class ManagerRefundBookingItemDto
{
    public string? CourtName { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

namespace ShuttleUp.BLL.DTOs.Venue;

public class CourtStatusUpdateDto
{
    public bool IsActive { get; set; }
    public bool Force { get; set; }
}

public class CourtBlockUpsertDto
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? ReasonCode { get; set; }
    public string? ReasonDetail { get; set; }
    public string? InternalNote { get; set; }
}

public class VenueCheckoutSettingsDto
{
    public string? PaymentBankName { get; set; }
    public string? PaymentBankBin { get; set; }
    public string? PaymentAccountNumber { get; set; }
    public string? PaymentAccountHolder { get; set; }
    public string? PaymentTransferNoteTemplate { get; set; }
    public string? PaymentNote { get; set; }
    public bool CancelAllowed { get; set; } = true;
    public int CancelBeforeMinutes { get; set; } = 120;
    public string RefundType { get; set; } = "NONE";
    public decimal? RefundPercent { get; set; }
    public string? VenueRules { get; set; }
    public bool ApplyToAll { get; set; } = false;
}

public class BankLookupDto
{
    public string Bin { get; set; } = "";
    public string AccountNumber { get; set; } = "";
}

public class CouponUpsertDto
{
    public string Code { get; set; } = null!;
    public string DiscountType { get; set; } = "PERCENT";
    public decimal DiscountValue { get; set; }
    public decimal? MinBookingValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? UsageLimit { get; set; }
    public bool IsActive { get; set; } = true;
    public bool OneUsePerUser { get; set; } = true;
}

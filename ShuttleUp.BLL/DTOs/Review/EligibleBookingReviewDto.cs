namespace ShuttleUp.BLL.DTOs.Review;

/// <summary>Booking tại venue mà user có thể đánh giá hoặc đang có review.</summary>
public class EligibleBookingReviewDto
{
    public Guid BookingId { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Còn trong 3 ngày kể từ lúc tạo booking.</summary>
    public bool ReviewWindowOpen { get; set; }

    public Guid? ExistingReviewId { get; set; }

    public bool CanSubmitNew { get; set; }
    public bool CanEditExisting { get; set; }

    // ── Thông tin hiển thị cho frontend ─────────────────────
    public string BookingCode { get; set; } = "";
    public string? VenueName { get; set; }
    public string? CourtLabel { get; set; }
    public string? DateLabel { get; set; }
    public string? TimeLabel { get; set; }
    public decimal FinalAmount { get; set; }
}

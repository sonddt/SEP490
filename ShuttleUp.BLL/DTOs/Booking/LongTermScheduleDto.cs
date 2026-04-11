namespace ShuttleUp.BLL.DTOs.Booking;

/// <summary>Phần lịch (dùng cho preview và create).</summary>
public class LongTermScheduleDto
{
    public Guid VenueId { get; set; }

    public Guid CourtId { get; set; }

    public string RangeStart { get; set; } = string.Empty;

    public string RangeEnd { get; set; } = string.Empty;

    public string SessionStartTime { get; set; } = string.Empty;

    public string SessionEndTime { get; set; } = string.Empty;

    public List<int> DaysOfWeek { get; set; } = new();

    /// <summary>
    /// Tùy chọn: khung giờ riêng cho từng ngày (khi người dùng tắt "Đồng bộ giờ").
    /// Nếu null / rỗng, hệ thống sẽ dùng SessionStartTime + SessionEndTime chung cho tất cả DaysOfWeek.
    /// </summary>
    public List<DailyScheduleDto>? DailySchedules { get; set; }

    public string? CouponCode { get; set; }
}

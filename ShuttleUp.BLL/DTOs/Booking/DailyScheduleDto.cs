namespace ShuttleUp.BLL.DTOs.Booking;

/// <summary>Khung giờ riêng cho từng ngày trong tuần (dùng khi người dùng tắt đồng bộ giờ).</summary>
public class DailyScheduleDto
{
    /// <summary>0 = Sunday, 1 = Monday, … 6 = Saturday.</summary>
    public int DayOfWeek { get; set; }

    public string StartTime { get; set; } = string.Empty;

    public string EndTime { get; set; } = string.Empty;
}

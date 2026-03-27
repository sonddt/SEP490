namespace ShuttleUp.BLL.DTOs.Booking;

/// <summary>Đặt lịch dài hạn — lặp theo tuần, một sân, một khung giờ cố định.</summary>
public class LongTermBookingRequestDto : LongTermScheduleDto
{
    public string ContactName { get; set; } = string.Empty;

    public string ContactPhone { get; set; } = string.Empty;

    public string? Note { get; set; }
}

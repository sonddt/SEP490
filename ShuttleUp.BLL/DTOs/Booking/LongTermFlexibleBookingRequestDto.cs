namespace ShuttleUp.BLL.DTOs.Booking;

public class LongTermFlexibleBookingRequestDto : LongTermFlexibleScheduleDto
{
    public string ContactName { get; set; } = string.Empty;

    public string ContactPhone { get; set; } = string.Empty;

    public string? Note { get; set; }

    /// <summary>
    /// Optional: if provided, update the existing HOLDING booking instead of creating a new one.
    /// </summary>
    public Guid? BookingId { get; set; }
}

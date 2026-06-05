namespace ShuttleUp.BLL.DTOs.Booking;

public class CreateBookingItemDto
{
    public Guid CourtId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }
}

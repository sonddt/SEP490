namespace ShuttleUp.BLL.DTOs.Booking;

public class CreateHoldResponseDto
{
    public Guid HoldId { get; set; }

    public DateTime ExpiresAt { get; set; }
}

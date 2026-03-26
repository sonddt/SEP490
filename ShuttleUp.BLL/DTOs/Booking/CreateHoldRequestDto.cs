namespace ShuttleUp.BLL.DTOs.Booking;

public class CreateHoldRequestDto
{
    public Guid VenueId { get; set; }

    public List<CreateBookingItemDto> Items { get; set; } = new();

    /// <summary>Thời gian giữ chỗ (phút), mặc định 15, tối đa 30.</summary>
    public int HoldMinutes { get; set; } = 15;
}

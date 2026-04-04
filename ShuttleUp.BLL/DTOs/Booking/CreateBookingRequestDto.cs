namespace ShuttleUp.BLL.DTOs.Booking;

public class CreateBookingRequestDto
{
    public Guid VenueId { get; set; }

    public List<CreateBookingItemDto> Items { get; set; } = new();

    public string ContactName { get; set; } = string.Empty;

    public string ContactPhone { get; set; } = string.Empty;

    public string? Note { get; set; }

    public string? CouponCode { get; set; }
}

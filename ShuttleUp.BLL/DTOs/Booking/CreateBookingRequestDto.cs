namespace ShuttleUp.BLL.DTOs.Booking;

public class CreateBookingRequestDto
{
    /// <summary>Khi có giá trị, server tạo đơn từ hold đã giữ chỗ (bỏ qua Items).</summary>
    public Guid? HoldId { get; set; }

    public Guid VenueId { get; set; }

    public List<CreateBookingItemDto> Items { get; set; } = new();

    public string ContactName { get; set; } = string.Empty;

    public string ContactPhone { get; set; } = string.Empty;

    public string? Note { get; set; }
}

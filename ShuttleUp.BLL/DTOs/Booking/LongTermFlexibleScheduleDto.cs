namespace ShuttleUp.BLL.DTOs.Booking;

/// <summary>Payload chung cho preview / tạo đơn lịch dài hạn linh hoạt (nhiều slot tự chọn).</summary>
public class LongTermFlexibleScheduleDto
{
    public Guid VenueId { get; set; }

    public List<CreateBookingItemDto> Items { get; set; } = new();
}

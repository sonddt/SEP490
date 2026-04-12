namespace ShuttleUp.BLL.DTOs.Booking;

public class PreviewDiscountDto
{
    public Guid VenueId { get; set; }
    
    public decimal BaseAmount { get; set; }
    
    /// <summary>
    /// Legacy field — khoảng cách ngày đầu→cuối. Bị OVERRIDE nếu BookedDates có giá trị.
    /// </summary>
    public int DaysDuration { get; set; } = 1;
    
    /// <summary>
    /// Danh sách các ngày thực sự có booking (ISO yyyy-MM-dd).
    /// Backend sẽ tính chuỗi liên tục dài nhất từ danh sách này.
    /// </summary>
    public List<string>? BookedDates { get; set; }
    
    public string? CouponCode { get; set; }
}

namespace ShuttleUp.BLL.DTOs.Booking;

public class PreviewDiscountDto
{
    public Guid VenueId { get; set; }
    
    public decimal BaseAmount { get; set; }
    
    public int DaysDuration { get; set; } = 1;
    
    public string? CouponCode { get; set; }
}

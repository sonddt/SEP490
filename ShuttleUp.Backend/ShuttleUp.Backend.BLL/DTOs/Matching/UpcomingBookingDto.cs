namespace ShuttleUp.BLL.DTOs.Matching;

public class UpcomingBookingDto
{
    public Guid Id { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public Guid? VenueId { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal? FinalAmount { get; set; }
    public bool HasDiscount { get; set; }
    public DateTime CreatedAt { get; set; }
    public IEnumerable<MatchingBookingItemDto>? Items { get; set; }
}

namespace ShuttleUp.BLL.DTOs.Review;

public class ReviewResponseDto
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public Guid UserId { get; set; }
    public string UserFullName { get; set; } = null!;
    public int Stars { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VenueRatingSummaryDto
{
    public double AverageStars { get; set; }
    public int ReviewCount { get; set; }
    public IEnumerable<ReviewResponseDto> Reviews { get; set; } = [];
}

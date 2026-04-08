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

    public List<string> ImageUrls { get; set; } = [];

    /// <summary>Id file ảnh (để form sửa gửi lại khi thay ảnh).</summary>
    public List<Guid> FileIds { get; set; } = [];

    public string? OwnerReply { get; set; }
    public DateTime? OwnerReplyAt { get; set; }
}

public class VenueRatingSummaryDto
{
    public double AverageStars { get; set; }
    public int ReviewCount { get; set; }
    public IEnumerable<ReviewResponseDto> Reviews { get; set; } = [];
}

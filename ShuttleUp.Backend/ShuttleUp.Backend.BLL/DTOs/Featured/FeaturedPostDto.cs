namespace ShuttleUp.BLL.DTOs.Featured;

public class FeaturedPostDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public string? Excerpt { get; set; }
    public string? Body { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? LinkUrl { get; set; }
    public bool IsPublished { get; set; }
    public DateTime? DisplayFrom { get; set; }
    public DateTime? DisplayUntil { get; set; }
    public string? AuthorRole { get; set; }
    public Guid? AuthorUserId { get; set; }
    public string? AuthorName { get; set; }
    public Guid? VenueId { get; set; }
    public string? VenueName { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

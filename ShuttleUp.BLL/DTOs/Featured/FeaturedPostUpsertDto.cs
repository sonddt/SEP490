namespace ShuttleUp.BLL.DTOs.Featured;

public class FeaturedPostUpsertDto
{
    public string Title { get; set; } = null!;
    public string? Excerpt { get; set; }
    public string? Body { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? LinkUrl { get; set; }
    public bool IsPublished { get; set; }
    public DateTime? DisplayFrom { get; set; }
    public DateTime? DisplayUntil { get; set; }
    public int SortOrder { get; set; }

    /// <summary>Chỉ Manager: gắn bài với cụm sân của mình. Admin có thể để null hoặc bất kỳ sân nào.</summary>
    public Guid? VenueId { get; set; }
}

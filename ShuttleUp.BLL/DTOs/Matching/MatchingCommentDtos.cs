namespace ShuttleUp.BLL.DTOs.Matching;

public class MatchingCommentDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Content { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsEdited { get; set; }
    public Guid? ParentCommentId { get; set; }
    public string? ReplyToFullName { get; set; }
    public int ReplyCount { get; set; }
    public Guid? AttachmentFileId { get; set; }
    public string? ImageUrl { get; set; }
}

public class CreateMatchingCommentDto
{
    public string Content { get; set; } = null!;
    public Guid? ParentCommentId { get; set; }
    public Guid? AttachmentFileId { get; set; }
}

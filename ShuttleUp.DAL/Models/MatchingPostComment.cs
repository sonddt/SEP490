using System;

namespace ShuttleUp.DAL.Models;

public partial class MatchingPostComment
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    /// <summary>Bình luận gốc được trả lời (chỉ 1 cấp: parent không có parent).</summary>
    public Guid? ParentCommentId { get; set; }

    public Guid UserId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public Guid? DeletedByUserId { get; set; }

    public Guid? AttachmentFileId { get; set; }

    public virtual MatchingPost Post { get; set; } = null!;

    public virtual File? AttachmentFile { get; set; }

    public virtual MatchingPostComment? ParentComment { get; set; }

    public virtual ICollection<MatchingPostComment> ChildComments { get; set; } = new List<MatchingPostComment>();

    public virtual User User { get; set; } = null!;

    public virtual User? DeletedByUser { get; set; }
}

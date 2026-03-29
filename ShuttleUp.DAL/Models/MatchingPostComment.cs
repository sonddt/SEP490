using System;

namespace ShuttleUp.DAL.Models;

public partial class MatchingPostComment
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public Guid UserId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public Guid? DeletedByUserId { get; set; }

    public virtual MatchingPost Post { get; set; } = null!;

    public virtual User User { get; set; } = null!;

    public virtual User? DeletedByUser { get; set; }
}

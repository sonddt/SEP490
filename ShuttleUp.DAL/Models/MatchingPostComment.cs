using System;

namespace ShuttleUp.DAL.Models;

public partial class MatchingPostComment
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public Guid UserId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime? CreatedAt { get; set; }

    public virtual MatchingPost Post { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}

using System;

namespace ShuttleUp.DAL.Models;

public partial class FriendRequest
{
    public Guid Id { get; set; }

    public Guid FromUserId { get; set; }

    public Guid ToUserId { get; set; }

    public string Status { get; set; } = "PENDING";

    public DateTime CreatedAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public virtual User? FromUser { get; set; }

    public virtual User? ToUser { get; set; }
}

using System;

namespace ShuttleUp.DAL.Models;

public partial class UserBlock
{
    public Guid BlockerId { get; set; }

    public Guid BlockedId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User? BlockerUser { get; set; }

    public virtual User? BlockedUser { get; set; }
}

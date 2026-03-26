using System;

namespace ShuttleUp.DAL.Models;

public partial class UserNotification
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Type { get; set; } = "BOOKING";

    public string Title { get; set; } = null!;

    public string? Body { get; set; }

    public string? MetadataJson { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User? User { get; set; }
}

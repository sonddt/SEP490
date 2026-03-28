using System;

namespace ShuttleUp.DAL.Models;

public partial class UserPrivacySettings
{
    public Guid UserId { get; set; }

    public bool AllowFindByEmail { get; set; } = true;

    public bool AllowFindByPhone { get; set; } = true;

    public virtual User? User { get; set; }
}

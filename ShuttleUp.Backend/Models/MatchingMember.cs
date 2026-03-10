using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class MatchingMember
{
    public Guid Id { get; set; }

    public Guid? PostId { get; set; }

    public Guid? UserId { get; set; }

    public virtual MatchingPost? Post { get; set; }

    public virtual User? User { get; set; }
}

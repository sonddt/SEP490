using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class MatchingJoinRequest
{
    public Guid Id { get; set; }

    public Guid? PostId { get; set; }

    public Guid? UserId { get; set; }

    public string? Message { get; set; }

    public string? Status { get; set; }

    public string? RejectReason { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual MatchingPost? Post { get; set; }

    public virtual User? User { get; set; }
}

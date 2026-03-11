using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class VenueApprovalRequest
{
    public Guid Id { get; set; }

    public Guid? VenueId { get; set; }

    public string? Status { get; set; }

    public Guid? AdminUserId { get; set; }

    public DateTime? DecisionAt { get; set; }

    public string? DecisionNote { get; set; }

    public virtual User? AdminUser { get; set; }

    public virtual Venue? Venue { get; set; }
}

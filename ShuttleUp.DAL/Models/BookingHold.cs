using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class BookingHold
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid VenueId { get; set; }

    /// <summary>ACTIVE | CONSUMED | EXPIRED | RELEASED</summary>
    public string Status { get; set; } = "ACTIVE";

    public DateTime ExpiresAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? CancellationPolicySnapshotJson { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Venue Venue { get; set; } = null!;

    public virtual ICollection<BookingHoldItem> BookingHoldItems { get; set; } = new List<BookingHoldItem>();
}

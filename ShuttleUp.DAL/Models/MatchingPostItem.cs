using System;

namespace ShuttleUp.DAL.Models;

public partial class MatchingPostItem
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public Guid BookingItemId { get; set; }

    public virtual MatchingPost Post { get; set; } = null!;

    public virtual BookingItem BookingItem { get; set; } = null!;
}

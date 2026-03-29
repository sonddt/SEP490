using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class BookingItem
{
    public Guid Id { get; set; }

    public Guid? BookingId { get; set; }

    public Guid? CourtId { get; set; }

    public DateTime? StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    public decimal? FinalPrice { get; set; }

    public string? Status { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual Court? Court { get; set; }

    public virtual ICollection<MatchingPostItem> MatchingPostItems { get; set; } = new List<MatchingPostItem>();
}

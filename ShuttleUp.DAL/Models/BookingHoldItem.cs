using System;

namespace ShuttleUp.DAL.Models;

public partial class BookingHoldItem
{
    public Guid Id { get; set; }

    public Guid HoldId { get; set; }

    public Guid CourtId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public decimal FinalPrice { get; set; }

    public virtual BookingHold Hold { get; set; } = null!;

    public virtual Court Court { get; set; } = null!;
}

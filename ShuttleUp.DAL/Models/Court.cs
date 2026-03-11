using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class Court
{
    public Guid Id { get; set; }

    public Guid? VenueId { get; set; }

    public string Name { get; set; } = null!;

    public string? SportType { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<CourtBlock> CourtBlocks { get; set; } = new List<CourtBlock>();

    public virtual ICollection<CourtPrice> CourtPrices { get; set; } = new List<CourtPrice>();

    public virtual Venue? Venue { get; set; }
}

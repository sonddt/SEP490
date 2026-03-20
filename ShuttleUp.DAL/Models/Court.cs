using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class Court
{
    public Guid Id { get; set; }

    public Guid? VenueId { get; set; }

    public string Name { get; set; } = null!;

    public string? Surface { get; set; }

    public int? MaxGuest { get; set; }

    public string? Description { get; set; }

    public string? SportType { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<CourtBlock> CourtBlocks { get; set; } = new List<CourtBlock>();

    public virtual ICollection<CourtOpenHour> CourtOpenHours { get; set; } = new List<CourtOpenHour>();

    public virtual ICollection<CourtPrice> CourtPrices { get; set; } = new List<CourtPrice>();

    public virtual ICollection<File> Files { get; set; } = new List<File>();

    public virtual Venue? Venue { get; set; }
}

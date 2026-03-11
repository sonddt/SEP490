using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class FavoriteVenue
{
    public Guid UserId { get; set; }

    public Guid VenueId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual Venue Venue { get; set; } = null!;
}

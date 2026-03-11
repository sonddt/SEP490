using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class Venue
{
    public Guid Id { get; set; }

    public Guid? OwnerUserId { get; set; }

    public string Name { get; set; } = null!;

    public string Address { get; set; } = null!;

    public decimal? Lat { get; set; }

    public decimal? Lng { get; set; }

    public string? ApprovalStatus { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual ICollection<Court> Courts { get; set; } = new List<Court>();

    public virtual ICollection<FavoriteVenue> FavoriteVenues { get; set; } = new List<FavoriteVenue>();

    public virtual User? OwnerUser { get; set; }

    public virtual ICollection<VenueApprovalRequest> VenueApprovalRequests { get; set; } = new List<VenueApprovalRequest>();

    public virtual ICollection<VenueOpenHour> VenueOpenHours { get; set; } = new List<VenueOpenHour>();

    public virtual ICollection<VenueReview> VenueReviews { get; set; } = new List<VenueReview>();

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class Booking
{
    public Guid Id { get; set; }

    public Guid? UserId { get; set; }

    public Guid? VenueId { get; set; }

    public string? Status { get; set; }

    public decimal? TotalAmount { get; set; }

    public decimal? DiscountAmount { get; set; }

    public decimal? FinalAmount { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<MatchingPost> MatchingPosts { get; set; } = new List<MatchingPost>();

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<RefundRequest> RefundRequests { get; set; } = new List<RefundRequest>();

    public virtual User? User { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual ICollection<VenueReview> VenueReviews { get; set; } = new List<VenueReview>();
}

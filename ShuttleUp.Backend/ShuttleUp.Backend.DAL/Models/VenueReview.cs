using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class VenueReview
{
    public Guid Id { get; set; }

    public Guid? VenueId { get; set; }

    public Guid? UserId { get; set; }

    public Guid? BookingId { get; set; }

    public int? Stars { get; set; }

    public string? Comment { get; set; }

    /// <summary>Phản hồi của chủ sân (manager) — hiển thị public.</summary>
    public string? OwnerReply { get; set; }

    public DateTime? OwnerReplyAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual User? User { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

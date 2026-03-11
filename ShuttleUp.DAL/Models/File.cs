using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class File
{
    public Guid Id { get; set; }

    public string FileUrl { get; set; } = null!;

    public string? FileName { get; set; }

    public string? MimeType { get; set; }

    public int? FileSize { get; set; }

    public Guid? UploadedByUserId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User? UploadedByUser { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();

    public virtual ICollection<RefundRequest> RefundRequests { get; set; } = new List<RefundRequest>();

    public virtual ICollection<ViolationReport> Reports { get; set; } = new List<ViolationReport>();

    public virtual ICollection<VenueReview> Reviews { get; set; } = new List<VenueReview>();

    public virtual ICollection<Venue> Venues { get; set; } = new List<Venue>();
}

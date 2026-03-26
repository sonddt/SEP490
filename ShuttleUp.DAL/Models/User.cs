using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class User
{
    public Guid Id { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string? About { get; set; }

    public string? PhoneNumber { get; set; }

    public string? Address { get; set; }

    public string? District { get; set; }

    public string? Province { get; set; }

    public string? Gender { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? SkillLevel { get; set; }

    public string? PlayPurpose { get; set; }

    public string? PlayFrequency { get; set; }

    public bool? IsPersonalized { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? BlockedAt { get; set; }

    public string? BlockedReason { get; set; }

    public Guid? BlockedBy { get; set; }

    public Guid? AvatarFileId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual File? AvatarFile { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();

    public virtual ICollection<CourtBlock> CourtBlocks { get; set; } = new List<CourtBlock>();

    public virtual ICollection<FavoriteVenue> FavoriteVenues { get; set; } = new List<FavoriteVenue>();

    public virtual ICollection<File> Files { get; set; } = new List<File>();

    public virtual ICollection<MatchingJoinRequest> MatchingJoinRequests { get; set; } = new List<MatchingJoinRequest>();

    public virtual ICollection<MatchingMember> MatchingMembers { get; set; } = new List<MatchingMember>();

    public virtual ICollection<MatchingPost> MatchingPosts { get; set; } = new List<MatchingPost>();

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<RefundRequest> RefundRequestProcessedByNavigations { get; set; } = new List<RefundRequest>();

    public virtual ICollection<RefundRequest> RefundRequestUsers { get; set; } = new List<RefundRequest>();

    public virtual ICollection<RefundTransaction> RefundTransactions { get; set; } = new List<RefundTransaction>();


    public virtual ICollection<VenueReview> VenueReviews { get; set; } = new List<VenueReview>();

    public virtual ICollection<Venue> Venues { get; set; } = new List<Venue>();

    public virtual ICollection<ViolationReport> ViolationReportAdminUsers { get; set; } = new List<ViolationReport>();

    public virtual ICollection<ViolationReport> ViolationReportReporterUsers { get; set; } = new List<ViolationReport>();

    public virtual ManagerProfile? ManagerProfileManager { get; set; }

    public virtual ICollection<ManagerProfile> ApprovedManagerProfiles { get; set; } = new List<ManagerProfile>();

    public virtual ICollection<Role> Roles { get; set; } = new List<Role>();
}

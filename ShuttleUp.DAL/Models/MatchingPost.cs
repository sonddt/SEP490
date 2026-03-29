using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class MatchingPost
{
    public Guid Id { get; set; }

    public Guid? CreatorUserId { get; set; }

    public Guid? BookingId { get; set; }

    public string? Title { get; set; }

    public DateOnly? PlayDate { get; set; }

    public TimeOnly? PlayStartTime { get; set; }

    public TimeOnly? PlayEndTime { get; set; }

    public Guid? VenueId { get; set; }

    public string? CourtName { get; set; }

    public decimal? PricePerSlot { get; set; }

    public int? RequiredPlayers { get; set; }

    public string? SkillLevel { get; set; }

    public string? GenderPref { get; set; }

    public string? ExpenseSharing { get; set; }

    public string? PlayPurpose { get; set; }

    public string? Notes { get; set; }

    public string? Status { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual ChatRoom? ChatRoom { get; set; }

    public virtual User? CreatorUser { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual ICollection<MatchingPostItem> MatchingPostItems { get; set; } = new List<MatchingPostItem>();

    public virtual ICollection<MatchingJoinRequest> MatchingJoinRequests { get; set; } = new List<MatchingJoinRequest>();

    public virtual ICollection<MatchingMember> MatchingMembers { get; set; } = new List<MatchingMember>();

    public virtual ICollection<MatchingPostComment> MatchingPostComments { get; set; } = new List<MatchingPostComment>();
}

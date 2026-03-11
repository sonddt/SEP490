using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class MatchingPost
{
    public Guid Id { get; set; }

    public Guid? CreatorUserId { get; set; }

    public Guid? BookingId { get; set; }

    public int? RequiredPlayers { get; set; }

    public string? SkillLevel { get; set; }

    public string? GenderPref { get; set; }

    public string? Notes { get; set; }

    public string? Status { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual ChatRoom? ChatRoom { get; set; }

    public virtual User? CreatorUser { get; set; }

    public virtual ICollection<MatchingJoinRequest> MatchingJoinRequests { get; set; } = new List<MatchingJoinRequest>();

    public virtual ICollection<MatchingMember> MatchingMembers { get; set; } = new List<MatchingMember>();
}

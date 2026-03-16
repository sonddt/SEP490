using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ChatRoom
{
    public Guid Id { get; set; }

    public string? Name { get; set; }

    public Guid? CreatedBy { get; set; }

    public Guid? PostId { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User? CreatedByUser { get; set; }

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();

    public virtual ICollection<ChatRoomMember> Members { get; set; } = new List<ChatRoomMember>();

    public virtual MatchingPost? Post { get; set; }
}

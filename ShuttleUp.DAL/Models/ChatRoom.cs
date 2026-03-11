using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ChatRoom
{
    public Guid Id { get; set; }

    public Guid? PostId { get; set; }

    public virtual ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();

    public virtual MatchingPost? Post { get; set; }
}

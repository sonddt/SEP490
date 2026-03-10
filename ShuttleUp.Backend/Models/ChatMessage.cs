using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class ChatMessage
{
    public Guid Id { get; set; }

    public Guid? ChatRoomId { get; set; }

    public Guid? SenderUserId { get; set; }

    public string? MessageText { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ChatRoom? ChatRoom { get; set; }

    public virtual User? SenderUser { get; set; }

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

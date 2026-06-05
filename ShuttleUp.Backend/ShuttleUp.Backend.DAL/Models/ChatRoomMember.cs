using System;

namespace ShuttleUp.DAL.Models;

public partial class ChatRoomMember
{
    public Guid RoomId { get; set; }

    public Guid UserId { get; set; }

    public DateTime? JoinedAt { get; set; }

    public virtual ChatRoom Room { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}

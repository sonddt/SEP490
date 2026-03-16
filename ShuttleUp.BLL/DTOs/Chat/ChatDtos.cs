using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Chat;

// ── Requests ─────────────────────────────────────────────────────────────────

public class CreateRoomRequestDto
{
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    /// <summary>Danh sách userId được mời vào room (ngoài người tạo)</summary>
    public List<Guid> MemberIds { get; set; } = [];
}

public class SendMessageRequestDto
{
    public string? MessageText { get; set; }

    /// <summary>FileId nếu gửi kèm ảnh (đã upload trước)</summary>
    public Guid? FileId { get; set; }
}

// ── Responses ─────────────────────────────────────────────────────────────────

public class MemberDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = null!;
}

public class RoomResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public IEnumerable<MemberDto> Members { get; set; } = [];
    public MessageResponseDto? LastMessage { get; set; }
}

public class MessageResponseDto
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Guid SenderUserId { get; set; }
    public string SenderName { get; set; } = null!;
    public string? MessageText { get; set; }
    public string? FileUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

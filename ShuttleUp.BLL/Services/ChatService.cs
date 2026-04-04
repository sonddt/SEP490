using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class ChatService : IChatService
{
    private readonly IChatRepository _chatRepo;

    public ChatService(IChatRepository chatRepo)
    {
        _chatRepo = chatRepo;
    }

    public async Task<IEnumerable<RoomResponseDto>> GetMyRoomsAsync(Guid userId)
    {
        var rooms = await _chatRepo.GetRoomsByUserAsync(userId);
        return rooms.Select(MapRoom);
    }

    public async Task<RoomResponseDto> CreateRoomAsync(Guid creatorId, CreateRoomRequestDto request)
    {
        var room = new ChatRoom
        {
            Id        = Guid.NewGuid(),
            Name      = request.Name,
            CreatedBy = creatorId,
            CreatedAt = DateTime.UtcNow,
        };

        // Thêm creator + các member được mời
        var memberIds = request.MemberIds.Append(creatorId).Distinct();
        await _chatRepo.CreateRoomAsync(room, memberIds);

        var created = await _chatRepo.GetRoomWithMembersAsync(room.Id);
        return MapRoom(created!);
    }

    public async Task<IEnumerable<MessageResponseDto>> GetMessagesAsync(
        Guid roomId, Guid userId, int page = 1)
    {
        if (!await _chatRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("Bạn không có quyền xem chat room này.");

        var messages = await _chatRepo.GetMessagesAsync(roomId, page);
        return messages.Select(MapMessage);
    }

    public async Task<MessageResponseDto> SaveMessageAsync(
        Guid roomId, Guid senderId, SendMessageRequestDto request)
    {
        if (!await _chatRepo.IsMemberAsync(roomId, senderId))
            throw new UnauthorizedAccessException("Bạn không phải thành viên của room này.");

        if (string.IsNullOrWhiteSpace(request.MessageText) && request.FileId == null)
            throw new ArgumentException("Tin nhắn không được để trống.");

        var message = new ChatMessage
        {
            Id           = Guid.NewGuid(),
            ChatRoomId   = roomId,
            SenderUserId = senderId,
            MessageText  = request.MessageText,
            CreatedAt    = DateTime.UtcNow,
        };

        var saved = await _chatRepo.SaveMessageAsync(message, request.FileId);
        return MapMessage(saved);
    }

    public Task<bool> IsMemberAsync(Guid roomId, Guid userId)
        => _chatRepo.IsMemberAsync(roomId, userId);

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static RoomResponseDto MapRoom(ChatRoom r) => new()
    {
        Id        = r.Id,
        Name      = r.Name ?? "(no name)",
        CreatedAt = r.CreatedAt ?? DateTime.UtcNow,
        Members   = r.Members.Select(m => new MemberDto
        {
            UserId   = m.UserId,
            FullName = m.User?.FullName ?? "Unknown",
        }),
        LastMessage = r.ChatMessages
            .OrderByDescending(m => m.CreatedAt)
            .Select(MapMessage)
            .FirstOrDefault(),
    };

    private static MessageResponseDto MapMessage(ChatMessage m) => new()
    {
        Id           = m.Id,
        RoomId       = m.ChatRoomId ?? Guid.Empty,
        SenderUserId = m.SenderUserId ?? Guid.Empty,
        SenderName   = m.SenderUser?.FullName ?? "Unknown",
        MessageText  = m.MessageText,
        FileUrl      = m.Files.FirstOrDefault()?.FileUrl,
        CreatedAt    = m.CreatedAt ?? DateTime.UtcNow,
    };
}

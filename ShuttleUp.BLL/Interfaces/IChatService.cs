using ShuttleUp.BLL.DTOs.Chat;

namespace ShuttleUp.BLL.Interfaces;

public interface IChatService
{
    Task<IEnumerable<RoomResponseDto>> GetMyRoomsAsync(Guid userId);
    Task<RoomResponseDto> CreateRoomAsync(Guid creatorId, CreateRoomRequestDto request);
    Task<IEnumerable<MessageResponseDto>> GetMessagesAsync(Guid roomId, Guid userId, int page = 1);
    Task<MessageResponseDto> SaveMessageAsync(Guid roomId, Guid senderId, SendMessageRequestDto request);
    Task<bool> IsMemberAsync(Guid roomId, Guid userId);
}

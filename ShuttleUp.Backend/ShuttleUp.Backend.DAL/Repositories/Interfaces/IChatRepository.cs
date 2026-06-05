using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IChatRepository
{
    /// <summary>Lấy danh sách room mà user là thành viên</summary>
    Task<IEnumerable<ChatRoom>> GetRoomsByUserAsync(Guid userId);

    /// <summary>Lấy room kèm Members</summary>
    Task<ChatRoom?> GetRoomWithMembersAsync(Guid roomId);

    /// <summary>Tạo room mới</summary>
    Task<ChatRoom> CreateRoomAsync(ChatRoom room, IEnumerable<Guid> memberIds);

    /// <summary>Thêm thành viên vào room</summary>
    Task AddMemberAsync(Guid roomId, Guid userId);

    /// <summary>Kiểm tra user có trong room không</summary>
    Task<bool> IsMemberAsync(Guid roomId, Guid userId);

    /// <summary>Lấy tin nhắn theo trang (mới nhất trước)</summary>
    Task<IEnumerable<ChatMessage>> GetMessagesAsync(Guid roomId, int page = 1, int pageSize = 50);

    /// <summary>Lưu tin nhắn mới (tùy chọn đính kèm file đã upload)</summary>
    Task<ChatMessage> SaveMessageAsync(ChatMessage message, Guid? attachmentFileId = null);
}

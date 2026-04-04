using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class ChatRepository : IChatRepository
{
    private readonly ShuttleUpDbContext _context;

    public ChatRepository(ShuttleUpDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ChatRoom>> GetRoomsByUserAsync(Guid userId)
        => await _context.ChatRooms
            .Where(r => r.Members.Any(m => m.UserId == userId))
            .Include(r => r.Members).ThenInclude(m => m.User)
            .Include(r => r.ChatMessages.OrderByDescending(msg => msg.CreatedAt).Take(1))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

    public async Task<ChatRoom?> GetRoomWithMembersAsync(Guid roomId)
        => await _context.ChatRooms
            .Include(r => r.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(r => r.Id == roomId);

    public async Task<ChatRoom> CreateRoomAsync(ChatRoom room, IEnumerable<Guid> memberIds)
    {
        _context.ChatRooms.Add(room);
        foreach (var uid in memberIds.Distinct())
        {
            _context.ChatRoomMembers.Add(new ChatRoomMember
            {
                RoomId   = room.Id,
                UserId   = uid,
                JoinedAt = DateTime.UtcNow,
            });
        }
        await _context.SaveChangesAsync();
        return room;
    }

    public async Task AddMemberAsync(Guid roomId, Guid userId)
    {
        if (!await IsMemberAsync(roomId, userId))
        {
            _context.ChatRoomMembers.Add(new ChatRoomMember
            {
                RoomId   = roomId,
                UserId   = userId,
                JoinedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> IsMemberAsync(Guid roomId, Guid userId)
        => await _context.ChatRoomMembers
            .AnyAsync(m => m.RoomId == roomId && m.UserId == userId);

    public async Task<IEnumerable<ChatMessage>> GetMessagesAsync(
        Guid roomId, int page = 1, int pageSize = 50)
        => await _context.ChatMessages
            .Where(m => m.ChatRoomId == roomId)
            .Include(m => m.SenderUser)
            .Include(m => m.Files)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.CreatedAt)  // trả về theo thứ tự cũ → mới
            .ToListAsync();

    public async Task<ChatMessage> SaveMessageAsync(ChatMessage message, Guid? attachmentFileId = null)
    {
        _context.ChatMessages.Add(message);
        if (attachmentFileId.HasValue)
        {
            var file = await _context.Files.FindAsync(attachmentFileId.Value);
            if (file != null) message.Files.Add(file);
        }

        await _context.SaveChangesAsync();
        await _context.Entry(message)
            .Reference(m => m.SenderUser)
            .LoadAsync();
        await _context.Entry(message)
            .Collection(m => m.Files)
            .LoadAsync();
        return message;
    }
}

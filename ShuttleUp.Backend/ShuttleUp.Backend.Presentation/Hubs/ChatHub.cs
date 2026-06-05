using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;
using System.Security.Claims;

namespace ShuttleUp.Backend.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;

    public ChatHub(IChatService chatService)
    {
        _chatService = chatService;
    }

    private Guid GetCurrentUserId()
    {
        var user = Context.User
            ?? throw new HubException("Không xác thực được người dùng (Context.User = null).");

        // .NET JWT middleware maps "sub" → ClaimTypes.NameIdentifier
        // JsonWebTokenHandler (.NET 8) giữ nguyên "sub"
        var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? user.FindFirst("sub")?.Value
                 ?? user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

        if (value == null)
        {
            var allClaims = string.Join(", ", user.Claims.Select(c => $"{c.Type}={c.Value}"));
            throw new HubException($"Không tìm thấy claim user ID. Claims hiện có: [{allClaims}]");
        }

        return Guid.Parse(value);
    }

    /// <summary>Join vào SignalR group của room (gọi khi mở chat)</summary>
    public async Task JoinRoom(string roomId)
    {
        if (!Guid.TryParse(roomId, out var id)) return;
        try
        {
            var userId = GetCurrentUserId();
            if (!await _chatService.IsMemberAsync(id, userId)) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        }
        catch (HubException) { throw; }
        catch (Exception ex)
        {
            throw new HubException($"JoinRoom lỗi: {ex.Message}");
        }
    }

    /// <summary>Rời SignalR group (gọi khi đóng chat)</summary>
    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
    }

    /// <summary>Gửi tin nhắn — lưu DB rồi broadcast đến cả group</summary>
    public async Task SendMessage(string roomId, string? messageText, Guid? fileId = null)
    {
        if (!Guid.TryParse(roomId, out var id))
            throw new HubException("roomId không hợp lệ.");

        var userId = GetCurrentUserId();

        var saved = await _chatService.SaveMessageAsync(id, userId, new SendMessageRequestDto
        {
            MessageText = messageText,
            FileId      = fileId,
        });

        // Broadcast đến tất cả user trong group (bao gồm cả người gửi)
        await Clients.Group(roomId).SendAsync("ReceiveMessage", saved);

        // Nếu người gửi chưa join group (vd: reconnect mà chưa gọi JoinRoom lại)
        // thì vẫn gửi lại riêng cho họ để họ thấy tin của mình
        await Clients.Caller.SendAsync("MessageSent", saved);
    }
}

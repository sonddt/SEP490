using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ShuttleUp.Backend.Hubs;

/// <summary>
/// Client gọi Join() sau khi kết nối (JWT qua query access_token) để nhận thông báo theo user.
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    public async Task Join()
    {
        var uid = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? Context.User?.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(uid))
            return;
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{uid}");
    }
}

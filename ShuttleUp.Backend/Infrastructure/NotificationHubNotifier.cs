using Microsoft.AspNetCore.SignalR;
using ShuttleUp.Backend.Hubs;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Infrastructure;

/// <summary>
/// Implementation of ISignalRNotifier using ASP.NET Core SignalR.
/// Lives in Backend layer to avoid BLL depending on SignalR Hub infrastructure.
/// </summary>
public class NotificationHubNotifier : ISignalRNotifier
{
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationHubNotifier(IHubContext<NotificationHub> hub)
    {
        _hub = hub;
    }

    public async Task SendNotificationAsync(Guid userId, object payload, CancellationToken cancellationToken = default)
    {
        var group = $"user-{userId}";
        await _hub.Clients.Group(group).SendAsync("notification", payload, cancellationToken);
    }

    public async Task SendBookingStatusAsync(Guid userId, object payload, CancellationToken cancellationToken = default)
    {
        var group = $"user-{userId}";
        await _hub.Clients.Group(group).SendAsync("bookingStatus", payload, cancellationToken);
    }
}

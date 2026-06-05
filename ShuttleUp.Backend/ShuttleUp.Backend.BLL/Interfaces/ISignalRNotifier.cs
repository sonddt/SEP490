namespace ShuttleUp.BLL.Interfaces;

/// <summary>
/// Abstraction for real-time push notifications via SignalR.
/// The actual implementation lives in ShuttleUp.Backend (NotificationHubNotifier)
/// to avoid a circular dependency between BLL and the Backend layer.
/// </summary>
public interface ISignalRNotifier
{
    /// <summary>
    /// Gửi thông báo real-time đến một user cụ thể qua SignalR group "user-{userId}".
    /// </summary>
    Task SendNotificationAsync(Guid userId, object payload, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gửi cập nhật trạng thái booking real-time đến user.
    /// </summary>
    Task SendBookingStatusAsync(Guid userId, object payload, CancellationToken cancellationToken = default);
}

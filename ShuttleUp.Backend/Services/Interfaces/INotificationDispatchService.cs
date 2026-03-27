namespace ShuttleUp.Backend.Services.Interfaces;

/// <summary>
/// Gửi thông báo in-app (DB + SignalR), tùy chọn email. Dùng cho mọi role qua user_id.
/// </summary>
public interface INotificationDispatchService
{
    /// <param name="bookingStatusPayload">Nếu có, gửi thêm event SignalR "bookingStatus" (tương thích client cũ).</param>
    Task NotifyUserAsync(
        Guid userId,
        string type,
        string title,
        string? body,
        object? metadata = null,
        bool sendEmail = false,
        object? bookingStatusPayload = null,
        CancellationToken cancellationToken = default);
}

namespace ShuttleUp.Backend.Services.Interfaces;

/// <summary>
/// Gửi thông báo in-app (DB + SignalR), tùy chọn email. Dùng cho mọi role qua user_id.
/// </summary>
public interface INotificationDispatchService
{
    /// <param name="bookingStatusPayload">Nếu có, gửi thêm event SignalR "bookingStatus" (tương thích client cũ).</param>
    /// <param name="htmlBodyOverride">Nếu có, dùng nguyên HTML này cho email thay vì tự sinh từ body (tránh double-encode).</param>
    Task NotifyUserAsync(
        Guid userId,
        string type,
        string title,
        string? body,
        object? metadata = null,
        bool sendEmail = false,
        object? bookingStatusPayload = null,
        string? htmlBodyOverride = null,
        CancellationToken cancellationToken = default);
}

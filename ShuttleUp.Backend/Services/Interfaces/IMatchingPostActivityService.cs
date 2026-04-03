namespace ShuttleUp.Backend.Services.Interfaces;

/// <summary>
/// Đồng bộ trạng thái bài matching khi hết ca chơi trong tương lai → <c>Inactive</c>.
/// </summary>
public interface IMatchingPostActivityService
{
    /// <summary>
    /// Quét và cập nhật mọi bài <c>OPEN</c>/<c>FULL</c> không còn <c>BookingItem.StartTime</c> sau <c>UtcNow</c>.
    /// Huỷ các join request <c>PENDING</c> liên quan.
    /// </summary>
    Task ApplyExpiredOpenAndFullToInactiveAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Kiểm tra một bài; nếu <c>OPEN</c>/<c>FULL</c> và hết slot tương lai thì chuyển <c>Inactive</c> và huỷ pending.
    /// </summary>
    Task EnsurePostInactiveIfElapsedAsync(Guid postId, CancellationToken cancellationToken = default);
}

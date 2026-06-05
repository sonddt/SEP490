using ShuttleUp.BLL.Constants;
using ShuttleUp.DAL.Models;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class MatchingPostLifecycleService : IMatchingPostLifecycleService
{
    private readonly IMatchingRepository _matchingRepo;
    private readonly IUserRepository _userRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationDispatchService _notify;

    public MatchingPostLifecycleService(
        IMatchingRepository matchingRepo,
        IUserRepository userRepo,
        IUnitOfWork unitOfWork,
        INotificationDispatchService notify)
    {
        _matchingRepo = matchingRepo;
        _userRepo = userRepo;
        _unitOfWork = unitOfWork;
        _notify = notify;
    }

    public async Task CancelPostsByBookingAsync(
        Booking booking,
        string? cancelledBy = null,
        CancellationToken cancellationToken = default)
    {
        if (booking == null)
            return;

        var bookingId = booking.Id;
        if (bookingId == Guid.Empty)
            return;

        var posts = (await _matchingRepo.GetPostsByBookingIdAsync(bookingId, cancellationToken)).ToList();

        if (posts.Count == 0)
            return;

        var now = DateTime.UtcNow;

        foreach (var post in posts)
        {
            post.Status = "CANCELLED";
            post.UpdatedAt = now;

            var pending = (await _matchingRepo.GetPendingRequestsByPostAsync(post.Id)).ToList();
            foreach (var r in pending)
            {
                r.Status = "CANCELLED";
                r.UpdatedAt = now;
            }
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Notifications (in-app + SignalR); no email.
        foreach (var post in posts)
        {
            var recipientIds = new HashSet<Guid>();

            if (post.CreatorUserId is { } hostId && hostId != Guid.Empty)
                recipientIds.Add(hostId);

            foreach (var m in post.MatchingMembers)
            {
                if (m.UserId is { } uid && uid != Guid.Empty)
                    recipientIds.Add(uid);
            }

            if (recipientIds.Count == 0)
                continue;

            var host = await _userRepo.GetByIdAsync(post.CreatorUserId ?? Guid.Empty);
            var hostName = host?.FullName ?? "Chủ bài";

            var bookingCode = "SU" + bookingId.ToString("N")[^6..].ToUpperInvariant();
            var title = "Bài ghép trận đã bị huỷ";
            var who = string.IsNullOrWhiteSpace(cancelledBy) ? "hệ thống" : cancelledBy.Trim();
            var body = $"Booking #{bookingCode}: Đơn đã bị hủy/từ chối bởi {who} nên bài \"{post.Title}\" không còn hiệu lực.";

            foreach (var uid in recipientIds)
            {
                await _notify.NotifyUserAsync(
                    uid,
                    NotificationTypes.MatchingPostCancelled,
                    title,
                    body,
                    new
                    {
                        postId = post.Id,
                        bookingId,
                        hostName,
                        entityType = "matching_post",
                        deepLink = $"/matching/{post.Id}"
                    },
                    sendEmail: false,
                    cancellationToken: cancellationToken);
            }
        }
    }
}


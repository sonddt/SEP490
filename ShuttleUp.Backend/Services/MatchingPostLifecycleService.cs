using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using Microsoft.EntityFrameworkCore;

namespace ShuttleUp.Backend.Services;

public class MatchingPostLifecycleService : IMatchingPostLifecycleService
{
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public MatchingPostLifecycleService(ShuttleUpDbContext db, INotificationDispatchService notify)
    {
        _db = db;
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

        var posts = await _db.MatchingPosts
            .Include(p => p.MatchingMembers)
            .Where(p => p.BookingId == bookingId && p.Status != "CANCELLED")
            .ToListAsync(cancellationToken);

        if (posts.Count == 0)
            return;

        var now = DateTime.UtcNow;

        foreach (var post in posts)
        {
            post.Status = "CANCELLED";
            post.UpdatedAt = now;

            var pending = await _db.MatchingJoinRequests
                .Where(r => r.PostId == post.Id && r.Status == "PENDING")
                .ToListAsync(cancellationToken);
            foreach (var r in pending)
            {
                r.Status = "CANCELLED";
                r.UpdatedAt = now;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

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

            var hostName = await _db.Users.AsNoTracking()
                .Where(u => u.Id == post.CreatorUserId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(cancellationToken) ?? "Chủ bài";

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


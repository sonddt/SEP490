using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

public class MatchingPostActivityService : IMatchingPostActivityService
{
    private readonly ShuttleUpDbContext _db;

    public MatchingPostActivityService(ShuttleUpDbContext db)
    {
        _db = db;
    }

    public async Task ApplyExpiredOpenAndFullToInactiveAsync(CancellationToken cancellationToken = default)
    {
        var localTime = DateTime.Now;

        var toMark = await _db.MatchingPosts
            .Where(p => p.Status == "OPEN" || p.Status == "FULL")
            .Where(p => !_db.MatchingPostItems.Any(mpi =>
                mpi.PostId == p.Id
                && mpi.BookingItem != null
                && mpi.BookingItem.StartTime != null
                && mpi.BookingItem.StartTime > localTime))
            .ToListAsync(cancellationToken);

        if (toMark.Count == 0)
            return;

        foreach (var p in toMark)
        {
            p.Status = "Inactive";
            p.UpdatedAt = localTime;
        }

        var postIds = toMark.Select(p => p.Id).ToList();
        var pending = await _db.MatchingJoinRequests
            .Where(r => r.PostId != null && postIds.Contains(r.PostId.Value) && r.Status == "PENDING")
            .ToListAsync(cancellationToken);

        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = localTime;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task EnsurePostInactiveIfElapsedAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.MatchingPosts
            .FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);
        if (post == null)
            return;
        if (post.Status != "OPEN" && post.Status != "FULL")
            return;

        var localTime = DateTime.Now;
        var hasFuture = await _db.MatchingPostItems
            .AnyAsync(mpi =>
                    mpi.PostId == postId
                    && mpi.BookingItem != null
                    && mpi.BookingItem.StartTime != null
                    && mpi.BookingItem.StartTime > localTime,
                cancellationToken);

        if (hasFuture)
            return;

        post.Status = "Inactive";
        post.UpdatedAt = localTime;

        var pending = await _db.MatchingJoinRequests
            .Where(r => r.PostId == postId && r.Status == "PENDING")
            .ToListAsync(cancellationToken);
        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = localTime;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}

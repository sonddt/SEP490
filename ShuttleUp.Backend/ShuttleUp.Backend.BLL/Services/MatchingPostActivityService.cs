using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class MatchingPostActivityService : IMatchingPostActivityService
{
    private readonly IMatchingRepository _matchingRepo;
    private readonly IUnitOfWork _unitOfWork;

    public MatchingPostActivityService(IMatchingRepository matchingRepo, IUnitOfWork unitOfWork)
    {
        _matchingRepo = matchingRepo;
        _unitOfWork = unitOfWork;
    }

    public async Task ApplyExpiredOpenAndFullToInactiveAsync(CancellationToken cancellationToken = default)
    {
        var localTime = DateTime.Now;

        var toMark = (await _matchingRepo.GetExpiredPostsAsync(localTime, cancellationToken)).ToList();

        if (toMark.Count == 0)
            return;

        foreach (var p in toMark)
        {
            p.Status = "Inactive";
            p.UpdatedAt = localTime;
        }

        var postIds = toMark.Select(p => p.Id).ToList();
        var pending = (await _matchingRepo.GetPendingRequestsForPostsAsync(postIds, cancellationToken)).ToList();

        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = localTime;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task EnsurePostInactiveIfElapsedAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var post = await _matchingRepo.GetByIdAsync(postId);
        if (post == null)
            return;
        if (post.Status != "OPEN" && post.Status != "FULL")
            return;

        var localTime = DateTime.Now;
        var hasFuture = await _matchingRepo.HasFutureBookingItemsAsync(postId, localTime, cancellationToken);

        if (hasFuture)
            return;

        post.Status = "Inactive";
        post.UpdatedAt = localTime;

        var pending = (await _matchingRepo.GetPendingRequestsByPostAsync(postId)).ToList();
        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = localTime;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

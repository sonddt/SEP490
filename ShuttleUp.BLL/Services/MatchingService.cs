using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class MatchingService : IMatchingService
{
    private readonly IMatchingRepository _matchingRepository;

    public MatchingService(IMatchingRepository matchingRepository)
    {
        _matchingRepository = matchingRepository;
    }

    public async Task<MatchingPost?> GetByIdAsync(Guid id)
        => await _matchingRepository.GetByIdAsync(id);

    public async Task<IEnumerable<MatchingPost>> GetOpenPostsAsync()
        => await _matchingRepository.GetOpenPostsAsync();

    public async Task<IEnumerable<MatchingPost>> GetByCreatorAsync(Guid creatorUserId)
        => await _matchingRepository.GetByCreatorAsync(creatorUserId);

    public async Task CreateAsync(MatchingPost post)
    {
        post.Id = Guid.NewGuid();
        post.CreatedAt = DateTime.UtcNow;
        post.Status = "OPEN";
        await _matchingRepository.AddAsync(post);
    }

    public async Task UpdateAsync(MatchingPost post)
        => await _matchingRepository.UpdateAsync(post);

    public async Task CloseAsync(Guid postId)
    {
        var post = await _matchingRepository.GetByIdAsync(postId);
        if (post == null) return;
        post.Status = "CLOSED";
        await _matchingRepository.UpdateAsync(post);
    }

    public async Task<MatchingJoinRequest> JoinRequestAsync(Guid postId, Guid userId)
    {
        var request = new MatchingJoinRequest
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            UserId = userId,
            Status = "PENDING"
        };
        return request;
    }

    public async Task ApproveJoinRequestAsync(Guid joinRequestId)
    {
        // TODO: implement approve logic
        await Task.CompletedTask;
    }

    public async Task RejectJoinRequestAsync(Guid joinRequestId)
    {
        // TODO: implement reject logic
        await Task.CompletedTask;
    }

    public async Task<IEnumerable<MatchingJoinRequest>> GetJoinRequestsByPostAsync(Guid postId)
        => await _matchingRepository.GetJoinRequestsByPostAsync(postId);
}

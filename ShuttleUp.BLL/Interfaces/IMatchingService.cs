using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IMatchingService
{
    Task<MatchingPost?> GetByIdAsync(Guid id);
    Task<IEnumerable<MatchingPost>> GetOpenPostsAsync();
    Task<IEnumerable<MatchingPost>> GetByCreatorAsync(Guid creatorUserId);
    Task CreateAsync(MatchingPost post);
    Task UpdateAsync(MatchingPost post);
    Task CloseAsync(Guid postId);
    Task<MatchingJoinRequest> JoinRequestAsync(Guid postId, Guid userId);
    Task ApproveJoinRequestAsync(Guid joinRequestId);
    Task RejectJoinRequestAsync(Guid joinRequestId);
    Task<IEnumerable<MatchingJoinRequest>> GetJoinRequestsByPostAsync(Guid postId);
}

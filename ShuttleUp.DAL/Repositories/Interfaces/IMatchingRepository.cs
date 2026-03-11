using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IMatchingRepository : IRepository<MatchingPost>
{
    Task<IEnumerable<MatchingPost>> GetOpenPostsAsync();
    Task<IEnumerable<MatchingPost>> GetByCreatorAsync(Guid creatorUserId);
    Task<IEnumerable<MatchingJoinRequest>> GetJoinRequestsByPostAsync(Guid postId);
}

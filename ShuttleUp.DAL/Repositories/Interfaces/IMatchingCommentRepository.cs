using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IMatchingCommentRepository : IRepository<MatchingPostComment>
{
    Task<IEnumerable<MatchingPostComment>> GetRootCommentsPagedAsync(Guid postId, string sort, int skip, int take);
    Task<int> CountRootCommentsAsync(Guid postId);
    Task<IEnumerable<MatchingPostComment>> GetRepliesPagedAsync(Guid postId, Guid rootId, int skip, int take);
    Task<int> CountRepliesAsync(Guid postId, Guid rootId);
    Task<Dictionary<Guid, int>> GetReplyCountsAsync(Guid postId);
    Task<MatchingPostComment?> GetWithIncludesAsync(Guid commentId);
    Task<DateTime?> GetLastCommentTimeAsync(Guid userId, Guid postId);
}

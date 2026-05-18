using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IMatchingRepository : IRepository<MatchingPost>
{
    Task<IEnumerable<MatchingPost>> GetPostsPagedAsync(string? skillLevel, string? province, DateOnly? playDate, string? sort, string? search, int skip, int take);
    Task<int> CountPostsAsync(string? skillLevel, string? province, DateOnly? playDate, string? search);
    Task<MatchingPost?> GetPostDetailAsync(Guid postId);
    Task<IEnumerable<MatchingPost>> GetMyPostsWithIncludesAsync(Guid userId);
    Task<IEnumerable<MatchingPost>> GetJoinedPostsWithIncludesAsync(Guid userId);
    
    // Join Requests
    Task<MatchingJoinRequest?> GetJoinRequestAsync(Guid requestId);
    Task AddJoinRequestAsync(MatchingJoinRequest request);
    Task UpdateJoinRequestAsync(MatchingJoinRequest request);
    Task<MatchingJoinRequest?> GetPendingJoinRequestAsync(Guid postId, Guid userId);
    Task<IEnumerable<MatchingJoinRequest>> GetPendingRequestsByPostAsync(Guid postId);
    
    // Members
    Task AddMemberAsync(MatchingMember member);
    Task<MatchingMember?> GetMemberAsync(Guid memberId);
    Task<MatchingMember?> GetMemberByPostAndUserAsync(Guid postId, Guid userId);
    Task RemoveMemberAsync(MatchingMember member);
    Task<int> CountMembersAsync(Guid postId);
}

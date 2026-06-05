using ShuttleUp.BLL.DTOs.Matching;

namespace ShuttleUp.BLL.Interfaces;

public interface IMatchingService
{
    Task<MatchingPagedResultDto<MatchingPostCardDto>> GetOpenPostsAsync(
        string? skillLevel, string? province, DateOnly? playDate, 
        string? sort, string? q, string? status, int page, int pageSize, Guid? currentUserId,
        CancellationToken ct = default);

    Task<IEnumerable<MatchingPostCardDto>> GetMyPostsAsync(Guid userId, CancellationToken ct = default);
    
    Task<IEnumerable<MatchingPostCardDto>> GetJoinedPostsAsync(Guid userId, CancellationToken ct = default);

    Task<MatchingPostDetailDto?> GetPostDetailAsync(Guid postId, Guid? currentUserId, CancellationToken ct = default);

    Task<Guid> CreatePostAsync(Guid userId, CreateMatchingPostDto dto, CancellationToken ct = default);

    Task UpdatePostAsync(Guid postId, Guid userId, UpdateMatchingPostDto dto, CancellationToken ct = default);

    Task ClosePostAsync(Guid postId, Guid userId, CancellationToken ct = default);

    Task<string> ReopenPostAsync(Guid postId, Guid userId, CancellationToken ct = default);

    Task<Guid> JoinPostAsync(Guid postId, Guid userId, string? message, CancellationToken ct = default);

    Task CancelJoinRequestAsync(Guid postId, Guid userId, CancellationToken ct = default);

    Task AcceptJoinRequestAsync(Guid requestId, Guid adminId, CancellationToken ct = default);

    Task RejectJoinRequestAsync(Guid requestId, Guid adminId, string? reason, CancellationToken ct = default);

    Task<string> RemoveMemberAsync(Guid memberId, Guid currentUserId, CancellationToken ct = default);

    Task<IEnumerable<UpcomingBookingDto>> GetUpcomingBookingsAsync(Guid userId, CancellationToken ct = default);
}

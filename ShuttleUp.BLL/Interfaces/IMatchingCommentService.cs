using Microsoft.AspNetCore.Http;
using ShuttleUp.BLL.DTOs.Matching;

namespace ShuttleUp.BLL.Interfaces;

public interface IMatchingCommentService
{
    Task<MatchingPagedResultDto<MatchingCommentDto>> GetRootCommentsPagedAsync(
        Guid postId, Guid userId, string sort, int page, int pageSize, CancellationToken ct = default);

    Task<MatchingPagedResultDto<MatchingCommentDto>> GetRepliesPagedAsync(
        Guid postId, Guid rootId, Guid userId, int page, int pageSize, CancellationToken ct = default);

    Task<MatchingCommentDto> PostCommentAsync(Guid userId, Guid postId, CreateMatchingCommentDto dto, CancellationToken ct = default);

    Task<MatchingCommentDto> UpdateCommentAsync(Guid userId, Guid postId, Guid commentId, CreateMatchingCommentDto dto, CancellationToken ct = default);

    Task DeleteCommentAsync(Guid userId, Guid postId, Guid commentId, CancellationToken ct = default);

    Task<(Guid fileId, string url)> UploadCommentImageAsync(Guid userId, Guid postId, IFormFile file, CancellationToken ct = default);
}

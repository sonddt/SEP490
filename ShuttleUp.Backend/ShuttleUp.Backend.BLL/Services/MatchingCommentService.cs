using Microsoft.AspNetCore.Http;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Matching;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.BLL.Services;

public class MatchingCommentService : IMatchingCommentService
{
    private const int CommentContentMaxLength = 2000;

    private readonly IMatchingCommentRepository _commentRepo;
    private readonly IMatchingRepository _matchingRepo;
    private readonly IFileRepository _fileRepo;
    private readonly IFileService _fileService;
    private readonly INotificationDispatchService _notify;
    private readonly IUserRepository _userRepo;

    public MatchingCommentService(
        IMatchingCommentRepository commentRepo,
        IMatchingRepository matchingRepo,
        IFileRepository fileRepo,
        IFileService fileService,
        INotificationDispatchService notify,
        IUserRepository userRepo)
    {
        _commentRepo = commentRepo;
        _matchingRepo = matchingRepo;
        _fileRepo = fileRepo;
        _fileService = fileService;
        _notify = notify;
        _userRepo = userRepo;
    }

    public async Task<MatchingPagedResultDto<MatchingCommentDto>> GetRootCommentsPagedAsync(
        Guid postId, Guid userId, string sort, int page, int pageSize, CancellationToken ct = default)
    {
        var isMember = await _matchingRepo.GetMemberByPostAndUserAsync(postId, userId);
        if (isMember == null) throw new UnauthorizedAccessException("Bạn không có quyền xem bình luận trong nhóm này.");

        var totalRoots = await _commentRepo.CountRootCommentsAsync(postId);
        var roots = await _commentRepo.GetRootCommentsPagedAsync(postId, sort, (page - 1) * pageSize, pageSize);
        var replyCounts = await _commentRepo.GetReplyCountsAsync(postId);

        var totalReplies = replyCounts.Values.Sum();

        return new MatchingPagedResultDto<MatchingCommentDto>
        {
            Total = totalRoots,
            TotalAll = totalRoots + totalReplies,
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Items = roots.Select(c => MapComment(c, replyCounts.GetValueOrDefault(c.Id, 0)))
        };
    }

    public async Task<MatchingPagedResultDto<MatchingCommentDto>> GetRepliesPagedAsync(
        Guid postId, Guid rootId, Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        var isMember = await _matchingRepo.GetMemberByPostAndUserAsync(postId, userId);
        if (isMember == null) throw new UnauthorizedAccessException("Bạn không có quyền xem bình luận trong nhóm này.");

        var total = await _commentRepo.CountRepliesAsync(postId, rootId);
        var replies = await _commentRepo.GetRepliesPagedAsync(postId, rootId, (page - 1) * pageSize, pageSize);

        return new MatchingPagedResultDto<MatchingCommentDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = replies.Select(c => MapComment(c, 0))
        };
    }

    public async Task<MatchingCommentDto> PostCommentAsync(Guid userId, Guid postId, CreateMatchingCommentDto dto, CancellationToken ct = default)
    {
        var post = await _matchingRepo.GetByIdAsync(postId);
        if (post == null) throw new KeyNotFoundException("Không tìm thấy bài đăng.");

        var isMember = await _matchingRepo.GetMemberByPostAndUserAsync(postId, userId);
        if (isMember == null) throw new UnauthorizedAccessException("Bạn không có quyền bình luận trong nhóm này.");

        if (IsInactiveStatus(post.Status))
            throw new InvalidOperationException("Bài đăng đã kết thúc — không thể gửi bình luận mới.");

        string? replyToFullName = null;
        Guid? parentId = null;
        Guid? parentAuthorId = null;

        if (dto.ParentCommentId.HasValue)
        {
            var parent = await _commentRepo.GetWithIncludesAsync(dto.ParentCommentId.Value);
            if (parent == null || parent.IsDeleted || parent.PostId != postId)
                throw new KeyNotFoundException("Không tìm thấy bình luận để trả lời.");
            if (parent.ParentCommentId != null)
                throw new InvalidOperationException("Chỉ trả lời được một cấp — hãy trả lời bình luận gốc.");

            parentId = parent.Id;
            parentAuthorId = parent.UserId;
            replyToFullName = parent.User?.FullName;
        }

        Guid? attachmentId = null;
        string? imageUrl = null;
        if (dto.AttachmentFileId.HasValue)
        {
            var att = await _fileRepo.GetByIdAsync(dto.AttachmentFileId.Value);
            if (att == null || att.UploadedByUserId != userId)
                throw new InvalidOperationException("Ảnh đính kèm không hợp lệ.");
            if (string.IsNullOrEmpty(att.MimeType) || !att.MimeType.StartsWith("image/"))
                throw new InvalidOperationException("Chỉ được đính kèm file ảnh.");
            
            attachmentId = att.Id;
            imageUrl = att.FileUrl;
        }

        var trimmedContent = dto.Content?.Trim() ?? string.Empty;
        if (trimmedContent.Length == 0 && !attachmentId.HasValue)
            throw new InvalidOperationException("Vui lòng nhập nội dung hoặc đính kèm một ảnh.");
        if (trimmedContent.Length > CommentContentMaxLength)
            throw new InvalidOperationException($"Bình luận tối đa {CommentContentMaxLength} ký tự.");

        // Rate limiting
        var lastAt = await _commentRepo.GetLastCommentTimeAsync(userId, postId);
        if (lastAt.HasValue && (DateTime.UtcNow - AsUtc(lastAt.Value)).TotalMilliseconds < 500)
            throw new InvalidOperationException("Bạn gửi quá nhanh. Vui lòng đợi một chút.");

        var comment = new MatchingPostComment
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            ParentCommentId = parentId,
            UserId = userId,
            Content = trimmedContent,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false,
            AttachmentFileId = attachmentId
        };

        await _commentRepo.AddAsync(comment);

        var me = await _userRepo.GetByIdAsync(userId);
        var meta = new { postId = postId, deepLink = $"/matching/{postId}" };
        var hostId = post.CreatorUserId;

        // Notifications
        if (!parentId.HasValue)
        {
            if (hostId.HasValue && hostId.Value != userId)
            {
                await _notify.NotifyUserAsync(hostId.Value, NotificationTypes.MatchingNewComment,
                    "Bình luận mới", $"{me?.FullName} vừa bình luận trong nhóm của bạn.", meta);
            }
        }
        else
        {
            if (hostId.HasValue && hostId.Value != userId)
            {
                await _notify.NotifyUserAsync(hostId.Value, NotificationTypes.MatchingCommentReply,
                    "Phản hồi mới", $"{me?.FullName} vừa trả lời một bình luận trên bài của bạn.", meta);
            }
            if (parentAuthorId.HasValue && parentAuthorId.Value != userId && parentAuthorId.Value != hostId)
            {
                await _notify.NotifyUserAsync(parentAuthorId.Value, NotificationTypes.MatchingCommentReply,
                    "Có người trả lời bạn", $"{me?.FullName} vừa trả lời bình luận của bạn.", meta);
            }
        }

        return new MatchingCommentDto
        {
            Id = comment.Id,
            UserId = userId,
            FullName = me?.FullName,
            AvatarUrl = me?.AvatarFile?.FileUrl,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            IsEdited = false,
            ParentCommentId = comment.ParentCommentId,
            ReplyToFullName = replyToFullName,
            AttachmentFileId = comment.AttachmentFileId,
            ImageUrl = imageUrl
        };
    }

    public async Task<MatchingCommentDto> UpdateCommentAsync(Guid userId, Guid postId, Guid commentId, CreateMatchingCommentDto dto, CancellationToken ct = default)
    {
        var comment = await _commentRepo.GetByIdAsync(commentId);
        if (comment == null || comment.PostId != postId) throw new KeyNotFoundException("Không tìm thấy bình luận.");
        if (comment.UserId != userId) throw new UnauthorizedAccessException("Bạn không có quyền sửa bình luận này.");
        if (comment.IsDeleted) throw new InvalidOperationException("Bình luận này đã bị xóa.");

        var trimmed = dto.Content?.Trim() ?? string.Empty;
        if (trimmed.Length == 0 && !comment.AttachmentFileId.HasValue)
            throw new InvalidOperationException("Vui lòng nhập nội dung hoặc giữ ảnh đính kèm.");
        if (trimmed.Length > CommentContentMaxLength)
            throw new InvalidOperationException($"Bình luận tối đa {CommentContentMaxLength} ký tự.");

        comment.Content = trimmed;
        comment.UpdatedAt = DateTime.UtcNow;
        await _commentRepo.UpdateAsync(comment);

        var projected = await _commentRepo.GetWithIncludesAsync(commentId);
        return MapComment(projected!, 0); // Reply count handled by UI refresh or similar
    }

    public async Task DeleteCommentAsync(Guid userId, Guid postId, Guid commentId, CancellationToken ct = default)
    {
        var comment = await _commentRepo.GetByIdAsync(commentId);
        if (comment == null || comment.PostId != postId) throw new KeyNotFoundException("Không tìm thấy bình luận.");
        
        var post = await _matchingRepo.GetByIdAsync(postId);
        var isHost = post?.CreatorUserId == userId;
        var isAuthor = comment.UserId == userId;

        if (!isHost && !isAuthor) throw new UnauthorizedAccessException("Bạn không có quyền gỡ bình luận này.");

        comment.IsDeleted = true;
        comment.DeletedAt = DateTime.UtcNow;
        comment.DeletedByUserId = userId;
        await _commentRepo.UpdateAsync(comment);
    }

    public async Task<(Guid fileId, string url)> UploadCommentImageAsync(Guid userId, Guid postId, IFormFile file, CancellationToken ct = default)
    {
        var isMember = await _matchingRepo.GetMemberByPostAndUserAsync(postId, userId);
        if (isMember == null) throw new UnauthorizedAccessException("Bạn không phải thành viên nhóm.");

        if (file == null || file.Length <= 0) throw new InvalidOperationException("Vui lòng chọn ảnh.");

        var upload = await _fileService.UploadMatchingCommentImageAsync(file, postId, userId, ct);

        var fileRow = new DalFile
        {
            Id = Guid.NewGuid(),
            FileUrl = upload.SecureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        await _fileRepo.AddAsync(fileRow);
        
        return (fileRow.Id, upload.SecureUrl);
    }

    // ── Helpers ──

    private static MatchingCommentDto MapComment(MatchingPostComment c, int replyCount)
    {
        return new MatchingCommentDto
        {
            Id = c.Id,
            UserId = c.UserId,
            FullName = c.User?.FullName,
            AvatarUrl = c.User?.AvatarFile?.FileUrl,
            Content = c.Content,
            CreatedAt = c.CreatedAt ?? DateTime.UtcNow,
            UpdatedAt = c.UpdatedAt,
            IsEdited = c.UpdatedAt.HasValue,
            ParentCommentId = c.ParentCommentId,
            ReplyToFullName = c.ParentComment?.User?.FullName,
            ReplyCount = replyCount,
            AttachmentFileId = c.AttachmentFileId,
            ImageUrl = c.AttachmentFile?.FileUrl
        };
    }

    private static bool IsInactiveStatus(string? status) =>
        string.Equals(status, "Inactive", StringComparison.OrdinalIgnoreCase);

    private static DateTime AsUtc(DateTime dt) =>
        dt.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) : dt.ToUniversalTime();
}

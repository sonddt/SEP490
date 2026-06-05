using ShuttleUp.BLL.DTOs.Featured;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class FeaturedPostService : IFeaturedPostService
{
    private readonly IFeaturedPostRepository _repo;

    public FeaturedPostService(IFeaturedPostRepository repo)
    {
        _repo = repo;
    }

    public async Task<List<FeaturedPostDto>> GetByAuthorAsync(Guid authorUserId, string authorRole)
    {
        var posts = await _repo.GetByAuthorAsync(authorUserId, authorRole);
        return posts.Select(p => MapToDto(p)).ToList();
    }

    public async Task<List<FeaturedPostDto>> GetAllAsync()
    {
        var posts = await _repo.GetAllOrderedAsync();
        return posts.Select(p => MapToDto(p)).ToList();
    }

    public async Task<List<FeaturedPostDto>> GetPublishedAsync()
    {
        var now = DateTime.Now; // Đồng nhất timezone với controller cũ (so sánh db datetime không dùng offset)
        var posts = await _repo.GetPublishedOrderedAsync(now);
        return posts.Select(p => MapToDto(p)).ToList();
    }

    public async Task<FeaturedPostDto> CreateAsync(Guid authorUserId, string authorRole, FeaturedPostUpsertDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new InvalidOperationException("Tiêu đề không được để trống.");

        // Validate venue ownership
        if (dto.VenueId.HasValue)
        {
            if (authorRole == "MANAGER")
            {
                var owns = await _repo.VenueOwnedByAsync(dto.VenueId.Value, authorUserId);
                if (!owns)
                    throw new InvalidOperationException("Bạn chỉ được gắn bài với cụm sân do bạn quản lý.");
            }
            else
            {
                var exists = await _repo.VenueExistsAsync(dto.VenueId.Value);
                if (!exists)
                    throw new InvalidOperationException("Cụm sân không tồn tại.");
            }
        }

        var now = DateTime.UtcNow;
        var post = new FeaturedPost
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            Excerpt = string.IsNullOrWhiteSpace(dto.Excerpt) ? null : dto.Excerpt.Trim(),
            Body = string.IsNullOrWhiteSpace(dto.Body) ? null : dto.Body.Trim(),
            CoverImageUrl = string.IsNullOrWhiteSpace(dto.CoverImageUrl) ? null : dto.CoverImageUrl.Trim(),
            LinkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : dto.LinkUrl.Trim(),
            IsPublished = dto.IsPublished,
            DisplayFrom = dto.DisplayFrom,
            DisplayUntil = dto.DisplayUntil,
            AuthorUserId = authorUserId,
            AuthorRole = authorRole,
            VenueId = dto.VenueId,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _repo.AddAsync(post);
        return MapToDto(post);
    }

    public async Task UpdateAsync(Guid postId, Guid? requiredAuthorId, string requiredRole, FeaturedPostUpsertDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new InvalidOperationException("Tiêu đề không được để trống.");

        var post = await _repo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Không tìm thấy bài đăng.");

        // Authorization check (Manager chỉ sửa bài của mình; Admin sửa bất kỳ)
        if (requiredAuthorId.HasValue)
        {
            if (post.AuthorUserId != requiredAuthorId.Value || post.AuthorRole != requiredRole)
                throw new UnauthorizedAccessException("Bạn không có quyền chỉnh sửa bài đăng này.");
        }

        // Validate venue ownership
        if (dto.VenueId.HasValue)
        {
            if (requiredAuthorId.HasValue) // Manager
            {
                var owns = await _repo.VenueOwnedByAsync(dto.VenueId.Value, requiredAuthorId.Value);
                if (!owns)
                    throw new InvalidOperationException("Bạn chỉ được gắn bài với cụm sân do bạn quản lý.");
            }
            else // Admin
            {
                var exists = await _repo.VenueExistsAsync(dto.VenueId.Value);
                if (!exists)
                    throw new InvalidOperationException("Cụm sân không tồn tại.");
            }
        }

        post.Title = dto.Title.Trim();
        post.Excerpt = string.IsNullOrWhiteSpace(dto.Excerpt) ? null : dto.Excerpt.Trim();
        post.Body = string.IsNullOrWhiteSpace(dto.Body) ? null : dto.Body.Trim();
        post.CoverImageUrl = string.IsNullOrWhiteSpace(dto.CoverImageUrl) ? null : dto.CoverImageUrl.Trim();
        post.LinkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : dto.LinkUrl.Trim();
        post.IsPublished = dto.IsPublished;
        post.DisplayFrom = dto.DisplayFrom;
        post.DisplayUntil = dto.DisplayUntil;
        post.VenueId = dto.VenueId;
        post.UpdatedAt = DateTime.UtcNow;

        await _repo.UpdateAsync(post);
    }

    public async Task DeleteAsync(Guid postId, Guid? requiredAuthorId, string requiredRole)
    {
        var post = await _repo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Không tìm thấy bài đăng.");

        if (requiredAuthorId.HasValue)
        {
            if (post.AuthorUserId != requiredAuthorId.Value || post.AuthorRole != requiredRole)
                throw new UnauthorizedAccessException("Bạn không có quyền xóa bài đăng này.");
        }

        await _repo.DeleteAsync(postId);
    }

    private static FeaturedPostDto MapToDto(FeaturedPost p) => new()
    {
        Id = p.Id,
        Title = p.Title,
        Excerpt = p.Excerpt,
        Body = p.Body,
        CoverImageUrl = p.CoverImageUrl,
        LinkUrl = p.LinkUrl,
        IsPublished = p.IsPublished,
        DisplayFrom = p.DisplayFrom,
        DisplayUntil = p.DisplayUntil,
        AuthorRole = p.AuthorRole,
        AuthorUserId = p.AuthorUserId,
        AuthorName = p.AuthorUser?.FullName,
        VenueId = p.VenueId,
        VenueName = p.Venue?.Name,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
    };
}

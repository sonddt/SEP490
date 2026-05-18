using ShuttleUp.BLL.DTOs.Featured;

namespace ShuttleUp.BLL.Interfaces;

public interface IFeaturedPostService
{
    // ── Manager ──
    Task<List<FeaturedPostDto>> GetByAuthorAsync(Guid authorUserId, string authorRole);
    Task<FeaturedPostDto> CreateAsync(Guid authorUserId, string authorRole, FeaturedPostUpsertDto dto);
    Task UpdateAsync(Guid postId, Guid? requiredAuthorId, string requiredRole, FeaturedPostUpsertDto dto);
    Task DeleteAsync(Guid postId, Guid? requiredAuthorId, string requiredRole);

    // ── Admin (xem tất cả) ──
    Task<List<FeaturedPostDto>> GetAllAsync();

    // ── Public ──
    Task<List<FeaturedPostDto>> GetPublishedAsync();
}

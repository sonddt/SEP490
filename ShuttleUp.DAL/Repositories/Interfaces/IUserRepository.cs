using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByPhoneAsync(string phoneNumber);
    Task<IEnumerable<User>> GetActiveUsersAsync();
    Task<IEnumerable<User>> GetBlockedUsersAsync();

    // ── Expanded ──
    Task<User?> GetWithRolesAsync(Guid userId);
    Task<List<Guid>> GetAdminUserIdsAsync();
    Task<int> CountAllAsync();
    Task<List<User>> GetUsersPagedAsync(string? search, string? role, string? status, int skip, int take);
    Task<int> CountUsersAsync(string? search, string? role, string? status);
    Task<List<User>> GetRecentUsersAsync(int count);
    Task<IEnumerable<User>> GetByIdsAsync(IEnumerable<Guid> ids);
    Task<User?> GetProfileWithDetailsAsync(Guid userId);
    Task<User?> GetProfileWithDetailsFallbackAsync(Guid userId);
    Task<bool> IsPhoneInUseAsync(Guid userId, string phoneNumber);
    Task UpdateProfileFallbackAsync(Guid userId, string fullName, string? phoneNumber);
}

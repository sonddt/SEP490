using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IManagerProfileRequestRepository
{
    Task<ManagerProfileRequest?> GetPendingByUserIdAsync(Guid userId);
    Task<ManagerProfileRequest?> GetLatestByUserIdAsync(Guid userId);
    Task AddAsync(ManagerProfileRequest request);
    Task UpdateAsync(ManagerProfileRequest request);

    // ── Expanded ──
    Task<ManagerProfileRequest?> GetWithUserAndRolesAsync(Guid requestId);
    Task<List<ManagerProfileRequest>> GetRequestsPagedAsync(string? search, string? status, int skip, int take);
    Task<int> CountRequestsAsync(string? search, string? status);
    Task<int> CountPendingAsync();
    Task<List<ManagerProfileRequest>> GetRecentPendingAsync(int count);
}

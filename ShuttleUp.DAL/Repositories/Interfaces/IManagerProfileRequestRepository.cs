using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IManagerProfileRequestRepository
{
    Task<ManagerProfileRequest?> GetPendingByUserIdAsync(Guid userId);
    Task<ManagerProfileRequest?> GetLatestByUserIdAsync(Guid userId);
    Task AddAsync(ManagerProfileRequest request);
    Task UpdateAsync(ManagerProfileRequest request);
}


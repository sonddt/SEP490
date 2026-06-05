using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IManagerProfileRepository
{
    Task<ManagerProfile?> GetByUserIdAsync(Guid userId);
    Task<IEnumerable<ManagerProfile>> GetAllAsync();
    Task AddAsync(ManagerProfile profile);
    Task UpdateAsync(ManagerProfile profile);
    Task DeleteAsync(Guid userId);
}

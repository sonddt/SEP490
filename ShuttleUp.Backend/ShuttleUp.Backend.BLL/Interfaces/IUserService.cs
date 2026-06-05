using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IUserService
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetAllAsync();
    Task<IEnumerable<User>> GetActiveUsersAsync();
    Task<IEnumerable<User>> GetBlockedUsersAsync();
    Task CreateAsync(User user);
    Task UpdateAsync(User user);
    Task DeleteAsync(Guid id);
    Task BlockUserAsync(Guid userId, Guid blockedBy, string reason);
    Task UnblockUserAsync(Guid userId);
}

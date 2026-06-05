using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;

    public UserService(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<User?> GetByIdAsync(Guid id)
        => await _userRepository.GetByIdAsync(id);

    public async Task<User?> GetByEmailAsync(string email)
        => await _userRepository.GetByEmailAsync(email);

    public async Task<IEnumerable<User>> GetAllAsync()
        => await _userRepository.GetAllAsync();

    public async Task<IEnumerable<User>> GetActiveUsersAsync()
        => await _userRepository.GetActiveUsersAsync();

    public async Task<IEnumerable<User>> GetBlockedUsersAsync()
        => await _userRepository.GetBlockedUsersAsync();

    public async Task CreateAsync(User user)
    {
        user.Id = Guid.NewGuid();
        user.CreatedAt = DateTime.UtcNow;
        user.IsActive = true;
        await _userRepository.AddAsync(user);
    }

    public async Task UpdateAsync(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
    }

    public async Task DeleteAsync(Guid id)
        => await _userRepository.DeleteAsync(id);

    public async Task BlockUserAsync(Guid userId, Guid blockedBy, string reason)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return;
        user.IsActive = false;
        user.BlockedAt = DateTime.UtcNow;
        user.BlockedBy = blockedBy;
        user.BlockedReason = reason;
        await _userRepository.UpdateAsync(user);
    }

    public async Task UnblockUserAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return;
        user.IsActive = true;
        user.BlockedAt = null;
        user.BlockedBy = null;
        user.BlockedReason = null;
        await _userRepository.UpdateAsync(user);
    }
}

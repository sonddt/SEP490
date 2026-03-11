using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<IEnumerable<User>> GetActiveUsersAsync()
    {
        return await _dbSet.Where(u => u.IsActive == true).ToListAsync();
    }

    public async Task<IEnumerable<User>> GetBlockedUsersAsync()
    {
        return await _dbSet.Where(u => u.IsActive == false && u.BlockedAt != null).ToListAsync();
    }
}

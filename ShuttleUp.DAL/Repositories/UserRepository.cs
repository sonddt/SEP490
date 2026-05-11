using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<User?> GetByEmailAsync(string email)
        => await _dbSet.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Email == email);

    public async Task<User?> GetByPhoneAsync(string phoneNumber)
        => await _dbSet.FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber);

    public async Task<IEnumerable<User>> GetActiveUsersAsync()
        => await _dbSet.Where(u => u.IsActive == true).ToListAsync();

    public async Task<IEnumerable<User>> GetBlockedUsersAsync()
        => await _dbSet.Where(u => u.IsActive == false).ToListAsync();

    public async Task<User?> GetWithRolesAsync(Guid userId)
        => await _dbSet.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == userId);

    public async Task<List<Guid>> GetAdminUserIdsAsync()
        => await _dbSet.Where(u => u.Roles.Any(r => r.Name == "ADMIN")).Select(u => u.Id).ToListAsync();

    public async Task<int> CountAllAsync()
        => await _dbSet.CountAsync();

    public async Task<List<User>> GetUsersPagedAsync(string? search, string? role, string? status, int skip, int take)
    {
        var q = _dbSet.Include(u => u.Roles).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(u => u.FullName.Contains(kw) || u.Email.Contains(kw));
        }
        if (!string.IsNullOrWhiteSpace(role))
            q = q.Where(u => u.Roles.Any(r => r.Name == role.Trim().ToUpper()));
        if (!string.IsNullOrWhiteSpace(status))
        {
            var isActive = status.Trim().ToLower() == "active";
            q = q.Where(u => u.IsActive == isActive);
        }
        return await q.OrderByDescending(u => u.CreatedAt).Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountUsersAsync(string? search, string? role, string? status)
    {
        var q = _dbSet.Include(u => u.Roles).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(u => u.FullName.Contains(kw) || u.Email.Contains(kw));
        }
        if (!string.IsNullOrWhiteSpace(role))
            q = q.Where(u => u.Roles.Any(r => r.Name == role.Trim().ToUpper()));
        if (!string.IsNullOrWhiteSpace(status))
        {
            var isActive = status.Trim().ToLower() == "active";
            q = q.Where(u => u.IsActive == isActive);
        }
        return await q.CountAsync();
    }

    public async Task<List<User>> GetRecentUsersAsync(int count)
        => await _dbSet.Include(u => u.Roles).OrderByDescending(u => u.CreatedAt).Take(count).ToListAsync();
}

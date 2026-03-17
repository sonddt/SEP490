using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class ManagerProfileRepository : IManagerProfileRepository
{
    private readonly ShuttleUpDbContext _context;

    public ManagerProfileRepository(ShuttleUpDbContext context)
    {
        _context = context;
    }

    public async Task<ManagerProfile?> GetByUserIdAsync(Guid userId)
    {
        return await _context.ManagerProfiles
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.UserId == userId);
    }

    public async Task<IEnumerable<ManagerProfile>> GetAllAsync()
    {
        return await _context.ManagerProfiles
            .Include(m => m.User)
            .ToListAsync();
    }

    public async Task AddAsync(ManagerProfile profile)
    {
        await _context.ManagerProfiles.AddAsync(profile);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ManagerProfile profile)
    {
        _context.ManagerProfiles.Update(profile);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid userId)
    {
        var profile = await GetByUserIdAsync(userId);
        if (profile != null)
        {
            _context.ManagerProfiles.Remove(profile);
            await _context.SaveChangesAsync();
        }
    }
}

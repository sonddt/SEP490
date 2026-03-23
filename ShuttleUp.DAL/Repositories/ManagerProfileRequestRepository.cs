using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class ManagerProfileRequestRepository : IManagerProfileRequestRepository
{
    private readonly ShuttleUpDbContext _context;

    public ManagerProfileRequestRepository(ShuttleUpDbContext context)
    {
        _context = context;
    }

    public async Task<ManagerProfileRequest?> GetPendingByUserIdAsync(Guid userId)
    {
        return await _context.ManagerProfileRequests
            .FirstOrDefaultAsync(r => r.UserId == userId && r.Status == "PENDING");
    }

    public async Task<ManagerProfileRequest?> GetLatestByUserIdAsync(Guid userId)
    {
        return await _context.ManagerProfileRequests
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync(r => r.UserId == userId);
    }

    public async Task AddAsync(ManagerProfileRequest request)
    {
        await _context.ManagerProfileRequests.AddAsync(request);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ManagerProfileRequest request)
    {
        _context.ManagerProfileRequests.Update(request);
        await _context.SaveChangesAsync();
    }
}


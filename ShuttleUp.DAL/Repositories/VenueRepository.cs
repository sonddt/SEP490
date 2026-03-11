using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class VenueRepository : Repository<Venue>, IVenueRepository
{
    public VenueRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId)
    {
        return await _dbSet.Where(v => v.OwnerUserId == ownerUserId).ToListAsync();
    }

    public async Task<IEnumerable<Venue>> GetApprovedVenuesAsync()
    {
        return await _dbSet.Where(v => v.ApprovalStatus == "APPROVED" && v.IsActive == true).ToListAsync();
    }

    public async Task<IEnumerable<Venue>> GetPendingApprovalAsync()
    {
        return await _dbSet.Where(v => v.ApprovalStatus == "PENDING").ToListAsync();
    }
}

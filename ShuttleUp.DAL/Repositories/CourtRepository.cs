using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class CourtRepository : Repository<Court>, ICourtRepository
{
    public CourtRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId)
    {
        return await _dbSet.Where(c => c.VenueId == venueId).ToListAsync();
    }

    public async Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId)
    {
        return await _dbSet.Where(c => c.VenueId == venueId && c.IsActive == true).ToListAsync();
    }
}

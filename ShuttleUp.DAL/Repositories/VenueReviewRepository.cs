using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class VenueReviewRepository : Repository<VenueReview>, IVenueReviewRepository
{
    public VenueReviewRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<IEnumerable<VenueReview>> GetByVenueAsync(Guid venueId)
        => await _dbSet
            .Where(r => r.VenueId == venueId)
            .Include(r => r.User)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

    public async Task<bool> HasUserReviewedAsync(Guid venueId, Guid userId)
        => await _dbSet.AnyAsync(r => r.VenueId == venueId && r.UserId == userId);
}

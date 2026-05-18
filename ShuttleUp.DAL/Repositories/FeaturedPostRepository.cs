using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class FeaturedPostRepository : Repository<FeaturedPost>, IFeaturedPostRepository
{
    public FeaturedPostRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<List<FeaturedPost>> GetByAuthorAsync(Guid authorUserId, string authorRole)
    {
        return await _dbSet
            .AsNoTracking()
            .Where(p => p.AuthorUserId == authorUserId && p.AuthorRole == authorRole)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();
    }

    public async Task<List<FeaturedPost>> GetAllOrderedAsync()
    {
        return await _dbSet
            .AsNoTracking()
            .Include(p => p.AuthorUser)
            .Include(p => p.Venue)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();
    }

    public async Task<List<FeaturedPost>> GetPublishedOrderedAsync(DateTime now)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(p => p.Venue)
            .Where(p => p.IsPublished
                        && (p.DisplayFrom == null || p.DisplayFrom <= now)
                        && (p.DisplayUntil == null || p.DisplayUntil >= now))
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();
    }

    public async Task<bool> VenueExistsAsync(Guid venueId)
    {
        return await _context.Venues.AnyAsync(v => v.Id == venueId);
    }

    public async Task<bool> VenueOwnedByAsync(Guid venueId, Guid managerId)
    {
        return await _context.Venues.AnyAsync(v => v.Id == venueId && v.OwnerUserId == managerId);
    }
}

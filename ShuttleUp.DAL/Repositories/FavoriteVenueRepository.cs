using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class FavoriteVenueRepository : Repository<FavoriteVenue>, IFavoriteVenueRepository
{
    public FavoriteVenueRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<List<Venue>> GetMyFavoritesAsync(Guid userId)
    {
        return await (from f in _context.FavoriteVenues
                      join v in _context.Venues on f.VenueId equals v.Id
                      where f.UserId == userId && v.IsActive == true
                      select v)
                      .Include(v => v.Courts)
                      .ThenInclude(c => c.CourtPrices)
                      .AsNoTracking()
                      .ToListAsync();
    }

    public async Task<bool> ExistsAsync(Guid userId, Guid venueId)
    {
        return await _dbSet.AnyAsync(f => f.UserId == userId && f.VenueId == venueId);
    }

    public async Task AddFavoriteAsync(Guid userId, Guid venueId)
    {
        _dbSet.Add(new FavoriteVenue
        {
            UserId = userId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
    }

    public async Task RemoveFavoriteAsync(Guid userId, Guid venueId)
    {
        var fav = await _dbSet.FirstOrDefaultAsync(f => f.UserId == userId && f.VenueId == venueId);
        if (fav != null)
        {
            _dbSet.Remove(fav);
            await _context.SaveChangesAsync();
        }
    }
}

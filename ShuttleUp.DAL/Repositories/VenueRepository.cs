using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class VenueRepository : Repository<Venue>, IVenueRepository
{
    public VenueRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId)
        => await _dbSet.Where(v => v.OwnerUserId == ownerUserId).ToListAsync();

    public async Task<IEnumerable<Venue>> GetApprovedVenuesAsync()
        => await _dbSet.Where(v => v.IsActive == true).ToListAsync();

    public async Task<Venue?> GetByIdWithFilesAsync(Guid id)
        => await _dbSet.Include(v => v.Files).FirstOrDefaultAsync(v => v.Id == id);

    public async Task<Venue?> GetByIdTrackedAsync(Guid id)
        => await _dbSet.FirstOrDefaultAsync(v => v.Id == id);

    public async Task<Venue?> GetByIdAndOwnerAsync(Guid id, Guid ownerId)
        => await _dbSet.AsNoTracking().FirstOrDefaultAsync(v => v.Id == id && v.OwnerUserId == ownerId);

    public async Task<List<Venue>> GetByOwnerPagedAsync(Guid ownerId, string? search, string? sortBy, string? sortDir, int skip, int take)
    {
        var q = _dbSet.Where(v => v.OwnerUserId == ownerId)
            .Include(v => v.Files).Include(v => v.Courts).Include(v => v.Bookings).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(v => (v.Name != null && v.Name.Contains(kw)) || (v.Address != null && v.Address.Contains(kw)));
        }

        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "name" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();
        q = (sortBy, sortDir) switch
        {
            ("name", "desc") => q.OrderByDescending(v => v.Name),
            ("createdat", "asc") => q.OrderBy(v => v.CreatedAt),
            ("createdat", "desc") => q.OrderByDescending(v => v.CreatedAt),
            _ => q.OrderBy(v => v.Name)
        };

        return await q.Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountByOwnerAsync(Guid ownerId, string? search)
    {
        var q = _dbSet.Where(v => v.OwnerUserId == ownerId).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(v => (v.Name != null && v.Name.Contains(kw)) || (v.Address != null && v.Address.Contains(kw)));
        }
        return await q.CountAsync();
    }

    public async Task<List<Guid>> GetVenueIdsByOwnerAsync(Guid ownerId)
        => await _dbSet.Where(v => v.OwnerUserId == ownerId).Select(v => v.Id).ToListAsync();

    public async Task<List<Venue>> GetByOwnerForCheckoutUpdateAsync(Guid ownerId, Guid excludeVenueId)
        => await _dbSet.Where(v => v.OwnerUserId == ownerId && v.Id != excludeVenueId).ToListAsync();

    // Publish validation
    public async Task<bool> HasActiveCourtAsync(Guid venueId)
        => await _context.Courts.AnyAsync(c => c.VenueId == venueId && c.IsActive == true);

    public async Task<bool> HasCourtPricingAsync(Guid venueId)
        => await _context.CourtPrices.AnyAsync(cp => cp.Court != null && cp.Court.VenueId == venueId);

    public async Task<bool> HasOpenHoursAsync(Guid venueId)
        => await _context.CourtOpenHours.AnyAsync(oh => oh.Court != null && oh.Court.VenueId == venueId);

    public async Task<bool> HasFutureBookingsAsync(Guid venueId)
    {
        var now = DateTime.UtcNow;
        return await _context.BookingItems.AnyAsync(bi =>
            bi.Court != null && bi.Court.VenueId == venueId && bi.EndTime > now &&
            bi.Booking != null && bi.Booking.Status != "CANCELLED");
    }

    // Stats
    public async Task<int> CountActiveAsync()
        => await _dbSet.CountAsync(v => v.IsActive == true);

    public async Task<List<Venue>> GetActiveWithBookingStatsAsync(DateTime? rangeStart, DateTime? rangeEnd, DateTime startOfMonthUtc, DateTime startOfPrevMonthUtc, DateTime endOfPrevMonthUtc)
        => await _dbSet.Where(v => v.IsActive == true).Include(v => v.Bookings).Include(v => v.OwnerUser).ToListAsync();
}

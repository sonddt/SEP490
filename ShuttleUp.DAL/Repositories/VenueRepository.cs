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

    // ── Public Browsing ──
    public async Task<Venue?> GetPublicVenueDetailsAsync(Guid id, CancellationToken ct = default)
    {
        return await _dbSet.AsNoTracking()
            .Include(v => v.Files)
            .Include(v => v.OwnerUser).ThenInclude(u => u!.AvatarFile)
            .Include(v => v.Courts).ThenInclude(c => c.CourtPrices)
            .Include(v => v.VenueReviews)
            .Include(v => v.VenueOpenHours)
            .FirstOrDefaultAsync(v => v.Id == id && v.IsActive == true, ct);
    }

    public IQueryable<Venue> GetPublicMapVenuesQueryable()
    {
        return _dbSet.AsNoTracking()
            .Where(v => v.IsActive == true && v.Lat.HasValue && v.Lng.HasValue)
            .Include(v => v.Courts).ThenInclude(c => c.CourtPrices);
    }

    public IQueryable<Venue> GetPublicApprovedVenuesQueryable()
    {
        return _dbSet.AsNoTracking()
            .Where(v => v.IsActive == true)
            .Include(v => v.OwnerUser).ThenInclude(u => u!.AvatarFile)
            .Include(v => v.Files)
            .Include(v => v.VenueReviews)
            .Include(v => v.Courts).ThenInclude(c => c.CourtPrices);
    }

    public async Task<List<Court>> GetPublicVenueCourtsAsync(Guid venueId, CancellationToken ct = default)
    {
        return await _context.Courts.AsNoTracking()
            .Include(c => c.CourtPrices)
            .Include(c => c.CourtOpenHours)
            .Where(c => c.VenueId == venueId && c.IsActive == true && c.Status == "ACTIVE")
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<List<BookingItem>> GetPublicBookedItemsAsync(Guid venueId, DateTime start, DateTime end, Guid? userId, DateTime now, CancellationToken ct = default)
    {
        var q = _context.BookingItems.AsNoTracking()
            .Where(bi => bi.Court != null && bi.Court.VenueId == venueId
                                          && bi.StartTime < end && bi.EndTime > start
                                          && bi.Booking != null && bi.Booking.Status != "CANCELLED");

        if (userId != null)
        {
            var me = userId.Value;
            q = q.Where(bi =>
                bi.Booking!.Status != "HOLDING" ||
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now && bi.Booking.UserId != me)
            );
        }
        else 
        {
            q = q.Where(bi => 
                bi.Booking!.Status != "HOLDING" || 
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now)
            );
        }

        return await q.ToListAsync(ct);
    }

    public async Task<List<CourtBlock>> GetPublicCourtBlocksAsync(Guid venueId, DateTime start, DateTime end, CancellationToken ct = default)
    {
        return await _context.CourtBlocks.AsNoTracking()
            .Where(b => b.Court != null && b.Court.VenueId == venueId
                                        && b.StartTime < end && b.EndTime > start)
            .ToListAsync(ct);
    }

    public async Task<List<CourtOpenHour>> GetPublicOpenHoursAsync(Guid venueId, int dayOfWeek, CancellationToken ct = default)
    {
        var courtIds = await _context.Courts.AsNoTracking()
            .Where(c => c.VenueId == venueId && c.IsActive == true && c.Status == "ACTIVE")
            .Select(c => c.Id)
            .ToListAsync(ct);

        if (!courtIds.Any()) return new List<CourtOpenHour>();

        return await _context.CourtOpenHours.AsNoTracking()
            .Where(o => o.CourtId != null && courtIds.Contains(o.CourtId.Value) && o.DayOfWeek == dayOfWeek)
            .ToListAsync(ct);
    }
}

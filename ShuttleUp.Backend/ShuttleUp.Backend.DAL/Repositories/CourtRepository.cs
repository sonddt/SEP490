using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class CourtRepository : Repository<Court>, ICourtRepository
{
    public CourtRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId)
        => await _dbSet.Where(c => c.VenueId == venueId).ToListAsync();

    public async Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId)
        => await _dbSet.Where(c => c.VenueId == venueId && c.IsActive == true).ToListAsync();

    public async Task<Court?> GetInVenueAsync(Guid venueId, Guid courtId)
        => await _dbSet.FirstOrDefaultAsync(c => c.Id == courtId && c.VenueId == venueId);

    public async Task<Court?> GetInVenueWithFilesAsync(Guid venueId, Guid courtId)
        => await _dbSet.Include(c => c.Files).FirstOrDefaultAsync(c => c.Id == courtId && c.VenueId == venueId);

    public async Task<List<Court>> GetByVenueWithPricesAndFilesAsync(Guid venueId)
        => await _dbSet.Where(c => c.VenueId == venueId).Include(c => c.Files).Include(c => c.CourtPrices).ToListAsync();

    // Court Prices
    public async Task ReplaceCourtPricesAsync(Guid courtId, List<CourtPrice> newPrices)
    {
        var old = _context.CourtPrices.Where(cp => cp.CourtId == courtId);
        _context.CourtPrices.RemoveRange(old);
        if (newPrices.Count > 0) _context.CourtPrices.AddRange(newPrices);
        await _context.SaveChangesAsync();
    }

    public async Task AddCourtPricesAsync(List<CourtPrice> prices)
    {
        _context.CourtPrices.AddRange(prices);
        await _context.SaveChangesAsync();
    }

    // Court Open Hours
    public async Task ReplaceCourtOpenHoursAsync(Guid courtId, List<CourtOpenHour> newHours)
    {
        var old = _context.CourtOpenHours.Where(oh => oh.CourtId == courtId);
        _context.CourtOpenHours.RemoveRange(old);
        if (newHours.Count > 0) _context.CourtOpenHours.AddRange(newHours);
        await _context.SaveChangesAsync();
    }

    public async Task AddCourtOpenHoursAsync(List<CourtOpenHour> hours)
    {
        _context.CourtOpenHours.AddRange(hours);
        await _context.SaveChangesAsync();
    }

    public async Task<List<CourtPrice>> GetCourtPricesAsync(Guid courtId)
        => await _context.CourtPrices.Where(p => p.CourtId == courtId).ToListAsync();

    public async Task<List<CourtOpenHour>> GetCourtOpenHoursAsync(Guid courtId)
        => await _context.CourtOpenHours.Where(o => o.CourtId == courtId).ToListAsync();

    // Stats
    public async Task<int> CountByVenueIdsAsync(List<Guid> venueIds)
        => await _dbSet.CountAsync(c => c.VenueId.HasValue && venueIds.Contains(c.VenueId.Value));

    public async Task<int> CountActiveByVenueIdsAsync(List<Guid> venueIds)
        => await _dbSet.CountAsync(c => c.VenueId.HasValue && venueIds.Contains(c.VenueId.Value) && c.IsActive == true);

    public async Task<int> CountFutureBookingsForCourtAsync(Guid courtId)
    {
        var now = DateTime.UtcNow;
        return await _context.BookingItems.AsNoTracking()
            .CountAsync(bi => bi.CourtId == courtId && bi.EndTime > now && bi.Booking != null && bi.Booking.Status != "CANCELLED");
    }

    public async Task<string?> GetCourtNameAsync(Guid courtId)
        => await _dbSet.AsNoTracking().Where(c => c.Id == courtId).Select(c => c.Name).FirstOrDefaultAsync();
}

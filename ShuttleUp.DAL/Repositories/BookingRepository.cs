using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public partial class BookingRepository : Repository<Booking>, IBookingRepository
{
    public BookingRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<IEnumerable<Booking>> GetByUserAsync(Guid userId)
        => await _dbSet.Where(b => b.UserId == userId).ToListAsync();
    public async Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId)
        => await _dbSet.Where(b => b.VenueId == venueId).ToListAsync();
    public async Task<IEnumerable<Booking>> GetByStatusAsync(string status)
        => await _dbSet.Where(b => b.Status == status).ToListAsync();
    public async Task<List<Booking>> GetConfirmedByUserAndVenueAsync(Guid userId, Guid venueId)
        => await _dbSet
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .Include(b => b.Venue)
            .Where(b => b.UserId == userId && b.VenueId == venueId && (b.Status == "CONFIRMED" || b.Status == "COMPLETED"))
            .ToListAsync();

    public async Task<Booking?> GetBookingWithVenueAsync(Guid id)
        => await _dbSet.AsNoTracking().Include(b => b.Venue).FirstOrDefaultAsync(b => b.Id == id);

    // Stats
    public async Task<int> CountByVenueIdsAsync(List<Guid> venueIds, DateTime? since)
    {
        var q = _dbSet.Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value));
        if (since.HasValue) q = q.Where(b => b.CreatedAt >= since.Value);
        return await q.CountAsync();
    }

    public async Task<int> CountByStatusInVenuesAsync(List<Guid> venueIds, string status)
        => await _dbSet.CountAsync(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value) && b.Status == status);

    public async Task<decimal> SumRevenueByVenueIdsAsync(List<Guid> venueIds, string[] paidStatuses, DateTime? since)
    {
        var q = _dbSet.Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value) && paidStatuses.Contains(b.Status));
        if (since.HasValue) q = q.Where(b => b.CreatedAt >= since.Value);
        return await q.SumAsync(b => b.FinalAmount ?? 0);
    }

    public async Task<List<Booking>> GetRecentByVenuesAsync(List<Guid> venueIds, int count)
        => await _dbSet.Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value))
            .Include(b => b.User).Include(b => b.Venue).Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .OrderByDescending(b => b.CreatedAt).Take(count).ToListAsync();

    public async Task<List<Booking>> GetByVenueIdsPagedAsync(List<Guid> venueIds, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, int skip, int take)
    {
        var q = BuildVenueQuery(venueIds, status, sinceUtc, untilUtc, search);
        return await q.OrderByDescending(b => b.CreatedAt).Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountByVenueIdsFilteredAsync(List<Guid> venueIds, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search)
        => await BuildVenueQuery(venueIds, status, sinceUtc, untilUtc, search).CountAsync();

    public async Task<decimal> SumRevenueByVenueIdsFilteredAsync(List<Guid> venueIds, string[] paidStatuses, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search)
        => await BuildVenueQuery(venueIds, status, sinceUtc, untilUtc, search).Where(b => paidStatuses.Contains(b.Status)).SumAsync(b => b.FinalAmount ?? 0);

    public async Task<List<Booking>> GetByVenueIdsWithCreatedAtAsync(List<Guid> venueIds, string[] paidStatuses, DateTime sinceUtc)
        => await _dbSet.AsNoTracking().Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value) && paidStatuses.Contains(b.Status) && b.CreatedAt >= sinceUtc)
            .Select(b => new Booking { CreatedAt = b.CreatedAt, FinalAmount = b.FinalAmount, Status = b.Status }).ToListAsync();

    // Admin stats
    public async Task<int> CountAllAsync(DateTime? since)
    {
        var q = _dbSet.AsQueryable();
        if (since.HasValue) q = q.Where(b => b.CreatedAt >= since.Value);
        return await q.CountAsync();
    }

    public async Task<decimal> SumAllRevenueAsync(string[] paidStatuses, DateTime? since)
    {
        var q = _dbSet.Where(b => paidStatuses.Contains(b.Status));
        if (since.HasValue) q = q.Where(b => b.CreatedAt >= since.Value);
        return await q.SumAsync(b => b.FinalAmount ?? 0);
    }

    public async Task<List<Booking>> GetAllPagedAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType, int skip, int take)
    {
        var q = BuildAllQuery(status, sinceUtc, untilUtc, search, bookingType);
        return await q.OrderByDescending(b => b.CreatedAt).Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountAllFilteredAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType)
        => await BuildAllQuery(status, sinceUtc, untilUtc, search, bookingType).CountAsync();

    public async Task<int> CountAllByStatusAsync(string targetStatus, string? filterStatus, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType)
        => await BuildAllQuery(filterStatus, sinceUtc, untilUtc, search, bookingType).CountAsync(b => b.Status == targetStatus);

    public async Task<List<BookingItem>> GetBookingItemsByVenuesInMonthAsync(List<Guid> venueIds, DateTime sinceUtc)
        => await _context.BookingItems
            .Include(bi => bi.Court).ThenInclude(c => c!.Venue)
            .Include(bi => bi.Booking)
            .Where(bi => bi.Court != null && bi.Court.VenueId.HasValue && venueIds.Contains(bi.Court.VenueId.Value) && bi.Booking != null && bi.Booking.CreatedAt >= sinceUtc)
            .ToListAsync();

    // ── Private query builders ──
    private IQueryable<Booking> BuildVenueQuery(List<Guid> venueIds, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search)
    {
        var q = _dbSet.Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value))
            .Include(b => b.User).Include(b => b.Venue).Include(b => b.BookingItems).ThenInclude(bi => bi.Court).AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") q = q.Where(b => b.Status == status.Trim().ToUpperInvariant());
        if (sinceUtc.HasValue) q = q.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value >= sinceUtc.Value);
        if (untilUtc.HasValue) q = q.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value < untilUtc.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(b => (b.User != null && b.User.FullName.Contains(kw)) || b.BookingItems.Any(bi => bi.Court != null && bi.Court.Name.Contains(kw)));
        }
        return q;
    }

    private IQueryable<Booking> BuildAllQuery(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType)
    {
        var q = _dbSet.AsNoTracking().AsSplitQuery().Include(b => b.Venue).Include(b => b.User)!.ThenInclude(u => u!.AvatarFile).Include(b => b.BookingItems).ThenInclude(bi => bi.Court)!.ThenInclude(c => c!.Files).Include(b => b.Payments).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(b => b.Status == status.Trim().ToUpperInvariant());
        if (sinceUtc.HasValue) q = q.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value >= sinceUtc.Value);
        if (untilUtc.HasValue) q = q.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value < untilUtc.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(b => (b.User != null && b.User.FullName.Contains(kw)) || (b.Venue != null && b.Venue.Name.Contains(kw)));
        }
        if (!string.IsNullOrWhiteSpace(bookingType))
        {
            if (bookingType == "LONG_TERM") q = q.Where(b => b.SeriesId != null);
            else if (bookingType == "SINGLE") q = q.Where(b => b.SeriesId == null);
        }
        return q;
    }
}

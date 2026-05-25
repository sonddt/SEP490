using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class RefundRepository : Repository<RefundRequest>, IRefundRepository
{
    public RefundRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<RefundRequest?> GetByIdForManagerAsync(Guid refundId, CancellationToken ct = default)
        => await _dbSet
            .Include(r => r.Booking).ThenInclude(b => b!.Payments)
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .Include(r => r.Booking).ThenInclude(b => b!.BookingItems)
            .FirstOrDefaultAsync(r => r.Id == refundId, ct);

    public async Task<RefundRequest?> GetActiveByBookingAndUserAsync(Guid bookingId, Guid userId, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(r =>
            r.BookingId == bookingId
            && r.UserId == userId
            && r.Status != "COMPLETED"
            && r.Status != "REJECTED", ct);

    public async Task<List<RefundRequest>> GetByVenueIdsAsync(List<Guid> venueIds, string? status, CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .Include(r => r.Booking).ThenInclude(b => b!.BookingItems)
            .Include(r => r.Booking).ThenInclude(b => b!.Payments)
            .Include(r => r.User)
            .Include(r => r.ManagerEvidenceFile)
            .Where(r => r.Booking != null && r.Booking.VenueId != null && venueIds.Contains(r.Booking.VenueId.Value));

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(r => r.Status == s);
        }

        return await query.OrderByDescending(r => r.RequestedAt).ToListAsync(ct);
    }

    public async Task<Dictionary<Guid, RefundRequest>> GetLatestByBookingIdsAsync(IEnumerable<Guid> bookingIds, CancellationToken ct = default)
    {
        var ids = bookingIds.ToList();
        if (ids.Count == 0) return new Dictionary<Guid, RefundRequest>();

        var list = await _dbSet.AsNoTracking()
            .Where(r => r.BookingId != null && ids.Contains(r.BookingId.Value))
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);

        return list
            .Where(r => r.BookingId.HasValue)
            .GroupBy(r => r.BookingId!.Value)
            .ToDictionary(g => g.Key, g => g.First());
    }
}

using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public partial class BookingRepository
{
    public async Task<Booking?> GetByIdWithItemsAndCourtsAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

    public async Task<Booking?> GetByIdWithItemsPaymentsVenueAsync(Guid id, Guid userId, bool asNoTracking, CancellationToken ct = default)
    {
        var q = _dbSet
            .Include(b => b.Venue)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .Include(b => b.Payments)
            .Where(b => b.Id == id && b.UserId == userId);
        if (asNoTracking) q = q.AsNoTracking();
        return await q.FirstOrDefaultAsync(ct);
    }

    public async Task<Booking?> GetByIdWithItemsPaymentsForCancelAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .Include(b => b.Venue)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct);

    public async Task<Booking?> GetByIdWithItemsPaymentsForCancelTrackedAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await _dbSet
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .Include(b => b.Venue)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct);

    public async Task<Booking?> GetByIdWithVenueOwnerForRemindAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await _dbSet
            .Include(b => b.Venue).ThenInclude(v => v!.OwnerUser)
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct);

    public async Task<Booking?> GetByIdWithItemsPaymentsVenueForPaymentAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await GetByIdWithItemsPaymentsVenueAsync(id, userId, asNoTracking: true, ct);

    public async Task<Booking?> GetByIdWithVenueOwnerPaymentsAsync(Guid id, Guid userId, CancellationToken ct = default)
        => await _dbSet
            .Include(b => b.Venue).ThenInclude(v => v!.OwnerUser)
            .Include(b => b.Payments)
            .Include(b => b.BookingItems)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, ct);

    public async Task<Booking?> GetByIdForManagerPatchAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(b => b.Venue)
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

    public async Task<List<Booking>> GetMyBookingsRawAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(b => b.Venue)
            .Include(b => b.Payments)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .Where(b => b.UserId == userId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

    public async Task<List<Booking>> GetManagerBookingsAsync(Guid ownerUserId, string? status, CancellationToken ct = default)
    {
        var query = _dbSet
            .AsNoTracking()
            .AsSplitQuery()
            .Include(b => b.Venue)
            .Include(b => b.User)!.ThenInclude(u => u!.AvatarFile)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)!.ThenInclude(c => c!.Files)
            .Include(b => b.Payments)
            .Where(b => b.Venue != null && b.Venue.OwnerUserId == ownerUserId && b.Status != "HOLDING");

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            if (s is "PENDING" or "CONFIRMED" or "CANCELLED")
                query = query.Where(b => b.Status == s);
        }

        return await query.OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
    }

    public Task<bool> HasUserUsedCouponAsync(Guid userId, Guid couponId, CancellationToken ct = default)
        => _dbSet.AsNoTracking().AnyAsync(b =>
            b.UserId == userId
            && b.CouponId == couponId
            && b.Status != null
            && b.Status != "CANCELLED", ct);

    public async Task<Guid?> GetVenueOwnerIdAsync(Guid venueId, CancellationToken ct = default)
        => await _context.Venues.AsNoTracking()
            .Where(v => v.Id == venueId)
            .Select(v => v.OwnerUserId)
            .FirstOrDefaultAsync(ct);

    public async Task<BookingSeries?> GetSeriesByIdAsync(Guid seriesId, CancellationToken ct = default)
        => await _context.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId, ct);

    public async Task UpdateSeriesAsync(BookingSeries series, bool saveChanges = true)
    {
        _context.BookingSeries.Update(series);
        if (saveChanges) await _context.SaveChangesAsync();
    }

    public async Task AddRefundRequestAsync(RefundRequest refund, bool saveChanges = true)
    {
        await _context.RefundRequests.AddAsync(refund);
        if (saveChanges) await _context.SaveChangesAsync();
    }

    public async Task AddPaymentAsync(Payment payment, bool saveChanges = true)
    {
        await _context.Payments.AddAsync(payment);
        if (saveChanges) await _context.SaveChangesAsync();
    }

    public async Task AddSeriesAsync(BookingSeries series, bool saveChanges = true)
    {
        await _context.BookingSeries.AddAsync(series);
        if (saveChanges) await _context.SaveChangesAsync();
    }
}

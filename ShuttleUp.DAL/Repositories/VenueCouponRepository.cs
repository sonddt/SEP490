using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class VenueCouponRepository : Repository<VenueCoupon>, IVenueCouponRepository
{
    public VenueCouponRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<List<VenueCoupon>> GetByVenueOrderedAsync(Guid venueId)
        => await _dbSet.Where(c => c.VenueId == venueId).OrderByDescending(c => c.CreatedAt).ToListAsync();

    public async Task<bool> CodeExistsAsync(Guid venueId, string code, Guid? excludeCouponId = null)
    {
        var q = _dbSet.Where(c => c.VenueId == venueId && c.Code == code);
        if (excludeCouponId.HasValue) q = q.Where(c => c.Id != excludeCouponId.Value);
        return await q.AnyAsync();
    }

    public async Task<VenueCoupon?> GetByIdInVenueAsync(Guid couponId, Guid venueId)
        => await _dbSet.FirstOrDefaultAsync(c => c.Id == couponId && c.VenueId == venueId);

    public async Task<VenueCoupon?> GetActiveByVenueAndCodeAsync(Guid venueId, string codeNorm, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(c => c.VenueId == venueId && c.Code == codeNorm && c.IsActive == true, ct);
}

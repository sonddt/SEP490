using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IVenueCouponRepository : IRepository<VenueCoupon>
{
    Task<List<VenueCoupon>> GetByVenueOrderedAsync(Guid venueId);
    Task<bool> CodeExistsAsync(Guid venueId, string code, Guid? excludeCouponId = null);
    Task<VenueCoupon?> GetByIdInVenueAsync(Guid couponId, Guid venueId);
    Task<VenueCoupon?> GetActiveByVenueAndCodeAsync(Guid venueId, string codeNorm, CancellationToken ct = default);
}

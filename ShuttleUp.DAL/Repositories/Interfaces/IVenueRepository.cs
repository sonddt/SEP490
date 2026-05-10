using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IVenueRepository : IRepository<Venue>
{
    Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId);
    Task<IEnumerable<Venue>> GetApprovedVenuesAsync();

    // ── Expanded ──
    Task<Venue?> GetByIdWithFilesAsync(Guid id);
    Task<Venue?> GetByIdTrackedAsync(Guid id);
    Task<Venue?> GetByIdAndOwnerAsync(Guid id, Guid ownerId);
    Task<List<Venue>> GetByOwnerPagedAsync(Guid ownerId, string? search, string? sortBy, string? sortDir, int skip, int take);
    Task<int> CountByOwnerAsync(Guid ownerId, string? search);
    Task<List<Guid>> GetVenueIdsByOwnerAsync(Guid ownerId);
    Task<List<Venue>> GetByOwnerForCheckoutUpdateAsync(Guid ownerId, Guid excludeVenueId);

    // Publish validation
    Task<bool> HasActiveCourtAsync(Guid venueId);
    Task<bool> HasCourtPricingAsync(Guid venueId);
    Task<bool> HasOpenHoursAsync(Guid venueId);
    Task<bool> HasFutureBookingsAsync(Guid venueId);

    // Stats
    Task<int> CountActiveAsync();
    Task<List<Venue>> GetActiveWithBookingStatsAsync(DateTime? rangeStart, DateTime? rangeEnd, DateTime startOfMonthUtc, DateTime startOfPrevMonthUtc, DateTime endOfPrevMonthUtc);
}

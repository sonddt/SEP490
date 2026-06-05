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
    Task<Venue?> GetByIdAndOwnerWithDetailsAsync(Guid id, Guid ownerId);
    Task ReplaceVenueOpenHoursAsync(Guid venueId, List<VenueOpenHour> newHours);
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

    // ── Public Browsing ──
    Task<Venue?> GetPublicVenueDetailsAsync(Guid id, CancellationToken ct = default);
    IQueryable<Venue> GetPublicMapVenuesQueryable();
    IQueryable<Venue> GetPublicApprovedVenuesQueryable();
    Task<List<Court>> GetPublicVenueCourtsAsync(Guid venueId, CancellationToken ct = default);
    Task<List<BookingItem>> GetPublicBookedItemsAsync(Guid venueId, DateTime start, DateTime end, Guid? userId, DateTime now, CancellationToken ct = default);
    Task<List<CourtBlock>> GetPublicCourtBlocksAsync(Guid venueId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<List<CourtOpenHour>> GetPublicOpenHoursAsync(Guid venueId, int dayOfWeek, CancellationToken ct = default);
}

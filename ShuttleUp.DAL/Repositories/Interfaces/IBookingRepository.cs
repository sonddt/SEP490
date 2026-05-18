using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IBookingRepository : IRepository<Booking>
{
    Task<IEnumerable<Booking>> GetByUserAsync(Guid userId);
    Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Booking>> GetByStatusAsync(string status);
    Task<List<Booking>> GetConfirmedByUserAndVenueAsync(Guid userId, Guid venueId);
    Task<Booking?> GetBookingWithVenueAsync(Guid id);

    // ── Expanded: Stats ──
    Task<int> CountByVenueIdsAsync(List<Guid> venueIds, DateTime? since = null);
    Task<int> CountByStatusInVenuesAsync(List<Guid> venueIds, string status);
    Task<decimal> SumRevenueByVenueIdsAsync(List<Guid> venueIds, string[] paidStatuses, DateTime? since = null);
    Task<List<Booking>> GetRecentByVenuesAsync(List<Guid> venueIds, int count);
    Task<List<Booking>> GetByVenueIdsPagedAsync(List<Guid> venueIds, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, int skip, int take);
    Task<int> CountByVenueIdsFilteredAsync(List<Guid> venueIds, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search);
    Task<decimal> SumRevenueByVenueIdsFilteredAsync(List<Guid> venueIds, string[] paidStatuses, string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search);
    Task<List<Booking>> GetByVenueIdsWithCreatedAtAsync(List<Guid> venueIds, string[] paidStatuses, DateTime sinceUtc);

    // ── Admin stats ──
    Task<int> CountAllAsync(DateTime? since = null);
    Task<decimal> SumAllRevenueAsync(string[] paidStatuses, DateTime? since = null);
    Task<List<Booking>> GetAllPagedAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, int skip, int take);
    Task<int> CountAllFilteredAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search);
    Task<int> CountAllByStatusAsync(string status, string? filterStatus, DateTime? sinceUtc, DateTime? untilUtc, string? search);

    // ── Manager analytics ──
    Task<List<BookingItem>> GetBookingItemsByVenuesInMonthAsync(List<Guid> venueIds, DateTime sinceUtc);
}

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

    // ── Ban flow ──
    Task<int> CountOngoingByOwnerAsync(Guid ownerUserId, CancellationToken ct = default);

    // ── Admin stats ──
    Task<int> CountAllAsync(DateTime? since = null);
    Task<decimal> SumAllRevenueAsync(string[] paidStatuses, DateTime? since = null);
    Task<List<Booking>> GetAllPagedAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType, int skip, int take);
    Task<int> CountAllFilteredAsync(string? status, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType);
    Task<int> CountAllByStatusAsync(string status, string? filterStatus, DateTime? sinceUtc, DateTime? untilUtc, string? search, string? bookingType);

    // ── Manager analytics ──
    Task<List<BookingItem>> GetBookingItemsByVenuesInMonthAsync(List<Guid> venueIds, DateTime sinceUtc);

    // ── Booking flow (Hưng) ──
    Task<Booking?> GetByIdWithItemsAndCourtsAsync(Guid id, CancellationToken ct = default);
    Task<Booking?> GetByIdWithItemsPaymentsVenueAsync(Guid id, Guid userId, bool asNoTracking, CancellationToken ct = default);
    Task<Booking?> GetByIdWithItemsPaymentsForCancelAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<Booking?> GetByIdWithItemsPaymentsForCancelTrackedAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<Booking?> GetByIdWithVenueOwnerForRemindAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<Booking?> GetByIdWithItemsPaymentsVenueForPaymentAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<Booking?> GetByIdWithVenueOwnerPaymentsAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<Booking?> GetByIdForManagerPatchAsync(Guid id, CancellationToken ct = default);
    Task<List<Booking>> GetMyBookingsRawAsync(Guid userId, CancellationToken ct = default);
    Task<List<Booking>> GetManagerBookingsAsync(Guid ownerUserId, string? status, CancellationToken ct = default);
    Task<bool> HasUserUsedCouponAsync(Guid userId, Guid couponId, CancellationToken ct = default);
    Task<Guid?> GetVenueOwnerIdAsync(Guid venueId, CancellationToken ct = default);
    Task<BookingSeries?> GetSeriesByIdAsync(Guid seriesId, CancellationToken ct = default);
    Task UpdateSeriesAsync(BookingSeries series, bool saveChanges = true);
    Task AddRefundRequestAsync(RefundRequest refund, bool saveChanges = true);
    Task AddPaymentAsync(Payment payment, bool saveChanges = true);
    Task AddSeriesAsync(BookingSeries series, bool saveChanges = true);

    Task<string?> CheckSlotConflictsAsync(
        List<Guid> courtIds,
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default,
        Guid? excludeBookingId = null,
        Guid? excludeHoldingUserId = null);

    Task<string?> CheckOpenHoursAsync(
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default);

    Task<(List<SmartAllocationRow> Items, string? Error)> AllocateFlexibleLongTermAsync(
        List<Court> allCourts,
        List<(DateTime Start, DateTime End)> requestedSlots,
        Guid? preferredCourtId,
        string pricePreference,
        CancellationToken ct = default);
}

/// <summary>Row kết quả phân bổ slot — DAL layer (map sang SmartAllocationItemDto ở BLL).</summary>
public record SmartAllocationRow(
    Guid? CourtId,
    string? CourtName,
    DateTime Start,
    DateTime End,
    decimal Price,
    bool IsUnavailable,
    bool IsSwitched,
    string? SwitchReason);

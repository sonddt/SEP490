using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IRefundRepository : IRepository<RefundRequest>
{
    Task<RefundRequest?> GetByIdForManagerAsync(Guid refundId, CancellationToken ct = default);
    Task<RefundRequest?> GetActiveByBookingAndUserAsync(Guid bookingId, Guid userId, CancellationToken ct = default);
    Task<List<RefundRequest>> GetByVenueIdsAsync(List<Guid> venueIds, string? status, CancellationToken ct = default);
    Task<Dictionary<Guid, RefundRequest>> GetLatestByBookingIdsAsync(IEnumerable<Guid> bookingIds, CancellationToken ct = default);

    /// <summary>Tổng tiền phạt giữ lại (PaidAmount − RequestedAmount) của các RefundRequest COMPLETED thuộc venueIds, tính theo CreatedAt của Booking gốc.</summary>
    Task<decimal> SumPenaltyByVenueIdsAsync(List<Guid> venueIds, DateTime? sinceUtc = null, DateTime? untilUtc = null, CancellationToken ct = default);
    
    /// <summary>Số lượt booking tạo ra doanh thu (COMPLETED RefundRequest với penalty > 0) thuộc venueIds trong khoảng thời gian.</summary>
    Task<int> CountPenaltyBookingsByVenueIdsAsync(List<Guid> venueIds, DateTime? sinceUtc = null, DateTime? untilUtc = null, CancellationToken ct = default);
    
    Task<Dictionary<Guid, decimal>> GetPenaltyByVenuesAsync(DateTime? sinceUtc = null, DateTime? untilUtc = null, CancellationToken ct = default);

    /// <summary>Tổng tiền phạt giữ lại trên toàn hệ thống (dành cho Admin).</summary>
    Task<decimal> SumAllPenaltyAsync(DateTime? sinceUtc = null, DateTime? untilUtc = null, CancellationToken ct = default);
}

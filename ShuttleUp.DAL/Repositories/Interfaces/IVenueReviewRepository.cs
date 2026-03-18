using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IVenueReviewRepository : IRepository<VenueReview>
{
    /// <summary>Lấy tất cả review của 1 venue, kèm thông tin user</summary>
    Task<IEnumerable<VenueReview>> GetByVenueAsync(Guid venueId);

    /// <summary>Kiểm tra user đã review venue này cho 1 booking cụ thể chưa</summary>
    Task<bool> HasUserReviewedBookingAsync(Guid bookingId, Guid userId);
}

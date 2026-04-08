using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IBookingRepository : IRepository<Booking>
{
    Task<IEnumerable<Booking>> GetByUserAsync(Guid userId);
    Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Booking>> GetByStatusAsync(string status);

    /// <summary>Đặt sân đã xác nhận của user tại một venue (để đánh giá).</summary>
    Task<List<Booking>> GetConfirmedByUserAndVenueAsync(Guid userId, Guid venueId);
}

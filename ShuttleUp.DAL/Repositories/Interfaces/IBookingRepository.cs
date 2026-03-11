using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IBookingRepository : IRepository<Booking>
{
    Task<IEnumerable<Booking>> GetByUserAsync(Guid userId);
    Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Booking>> GetByStatusAsync(string status);
}

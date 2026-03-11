using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IBookingService
{
    Task<Booking?> GetByIdAsync(Guid id);
    Task<IEnumerable<Booking>> GetAllAsync();
    Task<IEnumerable<Booking>> GetByUserAsync(Guid userId);
    Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Booking>> GetByStatusAsync(string status);
    Task CreateAsync(Booking booking);
    Task UpdateAsync(Booking booking);
    Task CancelAsync(Guid bookingId);
    Task ConfirmAsync(Guid bookingId);
}

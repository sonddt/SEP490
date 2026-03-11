using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class BookingService : IBookingService
{
    private readonly IBookingRepository _bookingRepository;

    public BookingService(IBookingRepository bookingRepository)
    {
        _bookingRepository = bookingRepository;
    }

    public async Task<Booking?> GetByIdAsync(Guid id)
        => await _bookingRepository.GetByIdAsync(id);

    public async Task<IEnumerable<Booking>> GetAllAsync()
        => await _bookingRepository.GetAllAsync();

    public async Task<IEnumerable<Booking>> GetByUserAsync(Guid userId)
        => await _bookingRepository.GetByUserAsync(userId);

    public async Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId)
        => await _bookingRepository.GetByVenueAsync(venueId);

    public async Task<IEnumerable<Booking>> GetByStatusAsync(string status)
        => await _bookingRepository.GetByStatusAsync(status);

    public async Task CreateAsync(Booking booking)
    {
        booking.Id = Guid.NewGuid();
        booking.CreatedAt = DateTime.UtcNow;
        booking.Status = "PENDING";
        await _bookingRepository.AddAsync(booking);
    }

    public async Task UpdateAsync(Booking booking)
        => await _bookingRepository.UpdateAsync(booking);

    public async Task CancelAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CANCELLED";
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task ConfirmAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CONFIRMED";
        await _bookingRepository.UpdateAsync(booking);
    }
}

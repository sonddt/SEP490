using ShuttleUp.DAL.Models;
using ShuttleUp.BLL.DTOs.Booking;

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

    Task<BookingResponseDto> CancelHoldAsync(Guid bookingId, Guid userId, CancellationToken ct);
    Task<(string Message, string Status, string CancelBranch, Guid? RefundRequestId)> CancelMyBookingAsync(Guid bookingId, Guid userId, CancelBookingBodyDto? body, CancellationToken ct);
    Task UpdateRefundBankInfoAsync(Guid bookingId, Guid userId, CancelBookingBodyDto body, CancellationToken ct);
    Task SubmitPaymentAsync(Guid bookingId, Guid userId, string method, string secureUrl, CancellationToken ct);
}

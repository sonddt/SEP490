using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services.Interfaces;

public interface IMatchingPostLifecycleService
{
    Task CancelPostsByBookingAsync(
        Booking booking,
        string? cancelledBy = null,
        CancellationToken cancellationToken = default);
}


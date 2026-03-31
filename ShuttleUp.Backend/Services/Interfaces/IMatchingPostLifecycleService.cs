using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services.Interfaces;

public interface IMatchingPostLifecycleService
{
    Task CancelPostsByBookingAsync(Booking booking, CancellationToken cancellationToken = default);
}


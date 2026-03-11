using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IPaymentRepository : IRepository<Payment>
{
    Task<IEnumerable<Payment>> GetByBookingAsync(Guid bookingId);
    Task<IEnumerable<Payment>> GetByStatusAsync(string status);
}

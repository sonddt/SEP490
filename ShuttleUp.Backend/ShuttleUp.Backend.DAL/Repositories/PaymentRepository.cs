using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class PaymentRepository : Repository<Payment>, IPaymentRepository
{
    public PaymentRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Payment>> GetByBookingAsync(Guid bookingId)
    {
        return await _dbSet.Where(p => p.BookingId == bookingId).ToListAsync();
    }

    public async Task<IEnumerable<Payment>> GetByStatusAsync(string status)
    {
        return await _dbSet.Where(p => p.Status == status).ToListAsync();
    }
}

using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class BookingRepository : Repository<Booking>, IBookingRepository
{
    public BookingRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Booking>> GetByUserAsync(Guid userId)
    {
        return await _dbSet.Where(b => b.UserId == userId).ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId)
    {
        return await _dbSet.Where(b => b.VenueId == venueId).ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetByStatusAsync(string status)
    {
        return await _dbSet.Where(b => b.Status == status).ToListAsync();
    }
}

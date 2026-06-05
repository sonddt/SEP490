using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class CourtBlockRepository : Repository<CourtBlock>, ICourtBlockRepository
{
    public CourtBlockRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<CourtBlock?> GetByIdInCourtAsync(Guid blockId, Guid courtId)
        => await _dbSet.FirstOrDefaultAsync(b => b.Id == blockId && b.CourtId == courtId);

    public async Task<List<CourtBlock>> GetBlocksInRangeAsync(Guid courtId, DateTime rangeStart, DateTime rangeEnd)
        => await _dbSet.AsNoTracking()
            .Where(b => b.CourtId == courtId && b.StartTime < rangeEnd && b.EndTime > rangeStart)
            .OrderBy(b => b.StartTime).ToListAsync();

    public async Task<bool> HasBookingOverlapAsync(Guid courtId, DateTime start, DateTime end)
        => await _context.BookingItems.AsNoTracking()
            .AnyAsync(bi => bi.CourtId == courtId && bi.StartTime < end && bi.EndTime > start &&
                            bi.Booking != null && bi.Booking.Status != "CANCELLED");

    public async Task<bool> HasBlockOverlapAsync(Guid courtId, DateTime start, DateTime end, Guid? excludeBlockId)
    {
        var q = _dbSet.AsNoTracking().Where(b => b.CourtId == courtId && b.StartTime < end && b.EndTime > start);
        if (excludeBlockId.HasValue) q = q.Where(b => b.Id != excludeBlockId.Value);
        return await q.AnyAsync();
    }

    public async Task<List<Guid>> GetAffectedUserIdsAsync(Guid courtId, DateTime start, DateTime end)
        => await _context.BookingItems.AsNoTracking()
            .Where(bi => bi.CourtId == courtId && bi.StartTime < end && bi.EndTime > start &&
                         bi.Booking != null && bi.Booking.Status != "CANCELLED" && bi.Booking.UserId != null)
            .Select(bi => bi.Booking!.UserId!.Value).Distinct().ToListAsync();
}

using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface ICourtBlockRepository : IRepository<CourtBlock>
{
    Task<CourtBlock?> GetByIdInCourtAsync(Guid blockId, Guid courtId);
    Task<List<CourtBlock>> GetBlocksInRangeAsync(Guid courtId, DateTime rangeStart, DateTime rangeEnd);
    Task<bool> HasBookingOverlapAsync(Guid courtId, DateTime start, DateTime end);
    Task<bool> HasBlockOverlapAsync(Guid courtId, DateTime start, DateTime end, Guid? excludeBlockId);
    Task<List<Guid>> GetAffectedUserIdsAsync(Guid courtId, DateTime start, DateTime end);
}

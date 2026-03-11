using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface ICourtRepository : IRepository<Court>
{
    Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId);
}

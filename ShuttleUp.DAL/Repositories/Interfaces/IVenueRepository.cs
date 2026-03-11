using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IVenueRepository : IRepository<Venue>
{
    Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId);
    Task<IEnumerable<Venue>> GetApprovedVenuesAsync();
    Task<IEnumerable<Venue>> GetPendingApprovalAsync();
}

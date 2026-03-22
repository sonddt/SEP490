using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueService
{
    Task<Venue?> GetByIdAsync(Guid id);
    Task<IEnumerable<Venue>> GetAllAsync();
    Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId);
    Task<IEnumerable<Venue>> GetApprovedVenuesAsync();

    Task CreateAsync(Venue venue);
    Task UpdateAsync(Venue venue);
    Task DeleteAsync(Guid id);

}

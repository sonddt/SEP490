using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface ICourtService
{
    Task<Court?> GetByIdAsync(Guid id);
    Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId);
    Task CreateAsync(Court court);
    Task UpdateAsync(Court court);
    Task DeleteAsync(Guid id);
    Task DeactivateAsync(Guid courtId);
}

using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueService
{
    Task<Venue?> GetByIdAsync(Guid id);
    Task<IEnumerable<Venue>> GetAllAsync();
    Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId);
    Task<IEnumerable<Venue>> GetApprovedVenuesAsync();
    Task<IEnumerable<Venue>> GetPendingApprovalAsync();
    Task CreateAsync(Venue venue);
    Task UpdateAsync(Venue venue);
    Task DeleteAsync(Guid id);
    Task ApproveAsync(Guid venueId, Guid adminUserId, string note);
    Task RejectAsync(Guid venueId, Guid adminUserId, string note);
}

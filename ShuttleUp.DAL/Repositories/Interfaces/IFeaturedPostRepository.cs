using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IFeaturedPostRepository : IRepository<FeaturedPost>
{
    Task<List<FeaturedPost>> GetByAuthorAsync(Guid authorUserId, string authorRole);
    Task<List<FeaturedPost>> GetAllOrderedAsync();
    Task<bool> VenueExistsAsync(Guid venueId);
    Task<bool> VenueOwnedByAsync(Guid venueId, Guid managerId);
}

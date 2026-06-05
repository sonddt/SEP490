using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IFavoriteVenueRepository : IRepository<FavoriteVenue>
{
    Task<List<Venue>> GetMyFavoritesAsync(Guid userId);
    Task<bool> ExistsAsync(Guid userId, Guid venueId);
    Task AddFavoriteAsync(Guid userId, Guid venueId);
    Task RemoveFavoriteAsync(Guid userId, Guid venueId);
}

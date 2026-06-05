using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShuttleUp.BLL.DTOs.Favorite;

namespace ShuttleUp.BLL.Interfaces;

public interface IFavoriteService
{
    Task<List<FavoriteVenueDto>> GetMyFavoritesAsync(Guid userId);
    Task AddFavoriteAsync(Guid userId, Guid venueId);
    Task RemoveFavoriteAsync(Guid userId, Guid venueId);
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ShuttleUp.BLL.DTOs.Favorite;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class FavoriteService : IFavoriteService
{
    private readonly IFavoriteVenueRepository _favoriteRepo;
    private readonly IVenueRepository _venueRepo;

    public FavoriteService(IFavoriteVenueRepository favoriteRepo, IVenueRepository venueRepo)
    {
        _favoriteRepo = favoriteRepo;
        _venueRepo = venueRepo;
    }

    public async Task<List<FavoriteVenueDto>> GetMyFavoritesAsync(Guid userId)
    {
        var venues = await _favoriteRepo.GetMyFavoritesAsync(userId);
        
        return venues.Select(v => new FavoriteVenueDto
        {
            Id = v.Id,
            Name = v.Name,
            Address = v.Address,
            Lat = v.Lat,
            Lng = v.Lng,
            MinPrice = v.Courts.SelectMany(c => c.CourtPrices).Any() 
                ? v.Courts.SelectMany(c => c.CourtPrices).Min(cp => (decimal?)cp.Price) 
                : null,
            MaxPrice = v.Courts.SelectMany(c => c.CourtPrices).Any() 
                ? v.Courts.SelectMany(c => c.CourtPrices).Max(cp => (decimal?)cp.Price) 
                : null
        }).ToList();
    }

    public async Task AddFavoriteAsync(Guid userId, Guid venueId)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId);
        if (venue == null || venue.IsActive == false)
            throw new KeyNotFoundException("Venue không tồn tại hoặc không hoạt động.");

        var exists = await _favoriteRepo.ExistsAsync(userId, venueId);
        if (exists)
            throw new InvalidOperationException("Đã có trong danh sách yêu thích.");

        await _favoriteRepo.AddFavoriteAsync(userId, venueId);
    }

    public async Task RemoveFavoriteAsync(Guid userId, Guid venueId)
    {
        var exists = await _favoriteRepo.ExistsAsync(userId, venueId);
        if (!exists)
            throw new KeyNotFoundException("Không có trong danh sách yêu thích.");

        await _favoriteRepo.RemoveFavoriteAsync(userId, venueId);
    }
}

using System;

namespace ShuttleUp.BLL.DTOs.Favorite;

public class FavoriteVenueDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
}

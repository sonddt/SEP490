using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;

    public FavoritesController(ShuttleUpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    /// <summary>
    /// Lấy danh sách venues đã được user đánh dấu yêu thích.
    /// Trả về các trường tối thiểu để FE render VenueCard.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyFavorites()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var favorites = await (from f in _dbContext.FavoriteVenues
                                join v in _dbContext.Venues on f.VenueId equals v.Id
                                where f.UserId == userId && v.IsActive == true
                                select new
                                {
                                    v.Id,
                                    v.Name,
                                    v.Address,
                                    v.Lat,
                                    v.Lng,
                                    // min/max của tất cả court_prices (weekday & weekend)
                                    MinPrice = v.Courts
                                        .SelectMany(c => c.CourtPrices)
                                        .Min(cp => (decimal?)cp.Price),
                                    MaxPrice = v.Courts
                                        .SelectMany(c => c.CourtPrices)
                                        .Max(cp => (decimal?)cp.Price)
                                }).ToListAsync();

        return Ok(favorites);
    }

    /// <summary>
    /// Thêm venue vào danh sách yêu thích.
    /// </summary>
    [HttpPost("{venueId:guid}")]
    public async Task<IActionResult> AddFavorite([FromRoute] Guid venueId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId && v.IsActive == true);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại hoặc không hoạt động." });

        var exists = await _dbContext.FavoriteVenues.AnyAsync(f => f.UserId == userId && f.VenueId == venueId);
        if (exists)
            return Ok(new { message = "Đã có trong danh sách yêu thích." });

        _dbContext.FavoriteVenues.Add(new FavoriteVenue
        {
            UserId = userId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Đã thêm vào yêu thích." });
    }

    /// <summary>
    /// Xoá venue khỏi danh sách yêu thích.
    /// </summary>
    [HttpDelete("{venueId:guid}")]
    public async Task<IActionResult> RemoveFavorite([FromRoute] Guid venueId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var fav = await _dbContext.FavoriteVenues.FirstOrDefaultAsync(f => f.UserId == userId && f.VenueId == venueId);
        if (fav == null)
            return Ok(new { message = "Không có trong danh sách yêu thích." });

        _dbContext.FavoriteVenues.Remove(fav);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Đã xoá khỏi yêu thích." });
    }
}


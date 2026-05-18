using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly IFavoriteService _favoriteService;

    public FavoritesController(IFavoriteService favoriteService)
    {
        _favoriteService = favoriteService;
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

        var favorites = await _favoriteService.GetMyFavoritesAsync(userId);
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

        try
        {
            await _favoriteService.AddFavoriteAsync(userId, venueId);
            return Ok(new { message = "Đã thêm vào yêu thích." });
        }
        catch (System.Collections.Generic.KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { message = ex.Message }); // Theo logic cũ
        }
    }

    /// <summary>
    /// Xoá venue khỏi danh sách yêu thích.
    /// </summary>
    [HttpDelete("{venueId:guid}")]
    public async Task<IActionResult> RemoveFavorite([FromRoute] Guid venueId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            await _favoriteService.RemoveFavoriteAsync(userId, venueId);
            return Ok(new { message = "Đã xoá khỏi yêu thích." });
        }
        catch (System.Collections.Generic.KeyNotFoundException ex)
        {
            return Ok(new { message = ex.Message }); // Theo logic cũ
        }
    }
}

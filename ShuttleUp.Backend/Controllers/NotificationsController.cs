using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;

    public NotificationsController(ShuttleUpDbContext dbContext)
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

    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 50)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        take = Math.Clamp(take, 1, 100);

        var rows = await _dbContext.UserNotifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new
            {
                n.Id,
                n.Type,
                n.Title,
                n.Body,
                n.MetadataJson,
                isRead = n.IsRead,
                n.CreatedAt,
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var n = await _dbContext.UserNotifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n == null)
            return NotFound();

        n.IsRead = true;
        await _dbContext.SaveChangesAsync();
        return Ok(new { n.Id, isRead = true });
    }
}

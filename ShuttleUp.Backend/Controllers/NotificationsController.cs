using System.Globalization;
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

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var count = await _dbContext.UserNotifications
            .AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead && !n.IsDeleted);

        return Ok(new { count });
    }

    /// <summary>Danh sách thông báo. Phân trang: gửi <paramref name="before"/> = nextBefore của lần trước (ISO 8601).</summary>
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 50, [FromQuery] string? before = null)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        take = Math.Clamp(take, 1, 100);

        DateTime? beforeUtc = null;
        if (!string.IsNullOrWhiteSpace(before)
            && DateTime.TryParse(before, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
        {
            beforeUtc = parsed.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
                : parsed.ToUniversalTime();
        }

        var q = _dbContext.UserNotifications
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsDeleted);

        if (beforeUtc.HasValue)
            q = q.Where(n => n.CreatedAt < beforeUtc.Value);

        var rows = await q
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.Id)
            .Take(take + 1)
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

        var hasMore = rows.Count > take;
        var page = hasMore ? rows.Take(take).ToList() : rows;

        DateTime? nextBefore = page.Count > 0 ? page[^1].CreatedAt : null;

        return Ok(new
        {
            items = page,
            hasMore,
            nextBefore = nextBefore.HasValue
                ? nextBefore.Value.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture)
                : null,
        });
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var n = await _dbContext.UserNotifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId && !x.IsDeleted);
        if (n == null)
            return NotFound();

        n.IsRead = true;
        await _dbContext.SaveChangesAsync();
        return Ok(new { n.Id, isRead = true });
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        await _dbContext.UserNotifications
            .Where(x => x.UserId == userId && !x.IsRead && !x.IsDeleted)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true));

        return Ok(new { message = "Đã đánh dấu đã đọc." });
    }

    /// <summary>Ẩn thông báo (soft delete).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SoftDelete([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var n = await _dbContext.UserNotifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId && !x.IsDeleted);
        if (n == null)
            return NotFound();

        n.IsDeleted = true;
        await _dbContext.SaveChangesAsync();
        return Ok(new { n.Id, deleted = true });
    }
}

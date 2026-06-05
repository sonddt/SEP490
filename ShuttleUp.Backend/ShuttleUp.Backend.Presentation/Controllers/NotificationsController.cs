using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly IUserNotificationService _notificationService;

    public NotificationsController(IUserNotificationService notificationService)
    {
        _notificationService = notificationService;
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

        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new { count });
    }

    /// <summary>Danh sách thông báo. Phân trang: gửi before = nextBefore của lần trước (ISO 8601).</summary>
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 50, [FromQuery] string? before = null)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await _notificationService.GetNotificationsPagedAsync(userId, take, before);
        return Ok(new
        {
            items = result.Items.Select(n => new
            {
                n.Id,
                n.Type,
                n.Title,
                n.Body,
                n.MetadataJson,
                isRead = n.IsRead,
                n.CreatedAt
            }),
            result.HasMore,
            result.NextBefore
        });
    }

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var success = await _notificationService.MarkReadAsync(id, userId);
        if (!success)
            return NotFound();

        return Ok(new { Id = id, isRead = true });
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        await _notificationService.MarkAllReadAsync(userId);
        return Ok(new { message = "Đã đánh dấu đã đọc." });
    }

    /// <summary>Ẩn thông báo (soft delete).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SoftDelete([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var success = await _notificationService.SoftDeleteAsync(id, userId);
        if (!success)
            return NotFound();

        return Ok(new { Id = id, deleted = true });
    }
}

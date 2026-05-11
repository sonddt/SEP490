using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Thống kê doanh thu và tổng quan cho Manager.
/// Routes: /api/manager/stats/...
/// </summary>
[ApiController]
[Route("api/manager/stats")]
[Authorize(Roles = "MANAGER")]
public class ManagerStatsController : ControllerBase
{
    private readonly IManagerStatsService _statsService;

    public ManagerStatsController(IManagerStatsService statsService)
    {
        _statsService = statsService;
    }

    // =========================================================================
    // GET /api/manager/stats/overview
    // =========================================================================

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        var result = await _statsService.GetOverviewAsync(managerId);
        return Ok(result);
    }

    // =========================================================================
    // GET /api/manager/stats/earnings
    // =========================================================================

    [HttpGet("earnings")]
    public async Task<IActionResult> GetEarnings(
        [FromQuery] Guid? venueId,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _statsService.GetEarningsPagedAsync(managerId, venueId, startDate, endDate, status, search, page, pageSize);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // ── Charts: doanh thu 30 ngày gần nhất ───────────────────────────────────

    [HttpGet("chart/daily")]
    public async Task<IActionResult> GetDailyChart([FromQuery] Guid? venueId, [FromQuery] int days = 30)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _statsService.GetDailyChartAsync(managerId, venueId, days);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    // =========================================================================
    // GET /api/manager/stats/earnings-analytics
    // =========================================================================

    [HttpGet("earnings-analytics")]
    public async Task<IActionResult> GetEarningsAnalytics()
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        var result = await _statsService.GetEarningsAnalyticsAsync(managerId);
        return Ok(result);
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub)
                 ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
    }
}

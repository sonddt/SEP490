using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Constants;
using ShuttleUp.BLL.DTOs.Admin;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Admin-only endpoints for ShuttleUp back-office.
/// All routes are protected with [Authorize(Roles = "ADMIN")].
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "ADMIN")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IBanService _banService;
    private readonly INotificationDispatchService _notify;

    public AdminController(
        IAdminService adminService,
        IBanService banService,
        INotificationDispatchService notify)
    {
        _adminService = adminService;
        _banService = banService;
        _notify = notify;
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var result = await _adminService.GetDashboardStatsAsync();
        return Ok(result);
    }

    // =========================================================================
    // ACCOUNT MANAGEMENT
    // =========================================================================

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetAccountsPagedAsync(search, role, status, page, pageSize);
        return Ok(result);
    }

    [HttpGet("accounts/{userId:guid}")]
    public async Task<IActionResult> GetAccount([FromRoute] Guid userId)
    {
        var result = await _adminService.GetAccountDetailAsync(userId);
        if (result == null) return NotFound(new { message = "Người dùng không tồn tại." });
        return Ok(result);
    }

    [HttpGet("accounts/{userId:guid}/ban-check")]
    public async Task<IActionResult> CheckBanScenario([FromRoute] Guid userId)
    {
        var result = await _banService.CheckBanScenarioAsync(userId);
        return Ok(new
        {
            scenario = result.Scenario.ToString(),
            ongoingBookingCount = result.OngoingBookingCount,
            isInGracePeriod = result.IsInGracePeriod,
            softBanExpiresAt = result.SoftBanExpiresAt
        });
    }

    [HttpPost("accounts/{userId:guid}/ban")]
    public async Task<IActionResult> BanAccount(
        [FromRoute] Guid userId,
        [FromBody] BanAccountRequest request)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được Admin." });

        if (userId == adminId)
            return BadRequest(new { message = "Không thể khoá tài khoản của chính mình." });

        var checkResult = await _banService.CheckBanScenarioAsync(userId);

        if (checkResult.Scenario == BanScenario.GracePeriod && !request.ForceHardBan)
        {
            await _banService.ExecuteSoftBanAsync(userId, adminId, request.Reason ?? "Vi phạm điều khoản.");
            return Ok(new { message = "Tài khoản đã được chuyển vào Giai đoạn ân hạn (Soft Ban)." });
        }

        if (checkResult.Scenario == BanScenario.OverrideGrace && !request.ForceHardBan)
        {
            return BadRequest(new { message = "Tài khoản đang trong giai đoạn ân hạn. Vui lòng xác nhận để khóa vĩnh viễn ngay lập tức." });
        }

        await _banService.ExecuteHardBanAsync(userId, adminId, request.Reason ?? "Vi phạm điều khoản.");
        return Ok(new { message = "Đã khoá tài khoản vĩnh viễn thành công." });
    }

    [HttpPost("accounts/{userId:guid}/unblock")]
    public async Task<IActionResult> UnblockAccount(
        [FromRoute] Guid userId,
        [FromBody] UnblockAccountRequest request)
    {
        try
        {
            await _adminService.UnblockAccountAsync(userId, request.RestoreVenues);

            var bannedUserCache = HttpContext.RequestServices.GetRequiredService<IBannedUserCache>();
            bannedUserCache.Remove(userId);

            return Ok(new { message = "Đã mở khoá tài khoản thành công.", userId });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // =========================================================================
    // MANAGER REQUESTS
    // =========================================================================

    [HttpGet("manager-requests")]
    public async Task<IActionResult> GetManagerRequests(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetManagerRequestsPagedAsync(search, status, page, pageSize);
        return Ok(result);
    }

    [HttpPost("manager-requests/{requestId:guid}/approve")]
    public async Task<IActionResult> ApproveRequest(
        [FromRoute] Guid requestId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _adminService.ApproveManagerRequestAsync(requestId, adminId, body.Note);

            // ── Notification (cross-cutting) ──
            await _notify.NotifyUserAsync(
                result.UserId,
                NotificationTypes.ManagerRequestApproved,
                "Hồ sơ Chủ sân đã được duyệt! 🎉",
                !string.IsNullOrWhiteSpace(body.Note)
                    ? $"Ghi chú từ Admin: {body.Note}"
                    : "Chúc mừng bạn đã trở thành Chủ sân trên ShuttleUp! Hãy bắt đầu thêm sân ngay nhé.",
                metadata: new { deepLink = "/manager/venues" },
                sendEmail: true);

            return Ok(new { message = "Đã duyệt Cấp quyền Chủ sân thành công." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("manager-requests/{requestId:guid}/reject")]
    public async Task<IActionResult> RejectRequest(
        [FromRoute] Guid requestId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _adminService.RejectManagerRequestAsync(requestId, adminId, body.Note);

            // ── Notification (cross-cutting) ──
            await _notify.NotifyUserAsync(
                result.UserId,
                NotificationTypes.ManagerRequestRejected,
                "Hồ sơ Chủ sân chưa được duyệt",
                $"Lý do: {body.Note?.Trim()}. Bạn có thể cập nhật lại hồ sơ và gửi lại.",
                metadata: new { deepLink = "/user/profile/manager-info" },
                sendEmail: true);

            return Ok(new { message = "Đã từ chối cấp quyền Chủ sân thành công." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    [HttpGet("stats/bookings")]
    public async Task<IActionResult> GetBookingStats(
        [FromQuery] string? status,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] string? search,
        [FromQuery] string? bookingType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _adminService.GetBookingStatsAsync(status, startDate, endDate, search, bookingType, page, pageSize);
        return Ok(result);
    }

    [HttpGet("stats/revenue")]
    public async Task<IActionResult> GetRevenueStats(
        [FromQuery] string? startDate,
        [FromQuery] string? endDate)
    {
        var result = await _adminService.GetRevenueStatsAsync(startDate, endDate);
        return Ok(result);
    }

    // ── Helper ──

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub)
                 ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
    }
}

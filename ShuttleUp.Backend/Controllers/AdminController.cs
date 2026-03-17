using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

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
    private readonly IUserService    _userService;
    private readonly IVenueService   _venueService;
    private readonly IBookingService _bookingService;
    private readonly ShuttleUpDbContext _db;

    public AdminController(
        IUserService    userService,
        IVenueService   venueService,
        IBookingService bookingService,
        ShuttleUpDbContext db)
    {
        _userService    = userService;
        _venueService   = venueService;
        _bookingService = bookingService;
        _db             = db;
    }

    // =========================================================================
    // DASHBOARD — Tổng quan hệ thống
    // GET api/admin/dashboard
    // =========================================================================

    /// <summary>
    /// Trả về các số liệu tổng quan cho trang Admin Dashboard.
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var totalUsers       = await _db.Users.CountAsync();
        var activeVenues     = await _db.Venues.CountAsync(v => v.IsActive == true);
        var todayStart       = DateTime.UtcNow.Date;
        var todayEnd         = todayStart.AddDays(1);
        var todayBookings    = await _db.Bookings
            .CountAsync(b => b.CreatedAt >= todayStart && b.CreatedAt < todayEnd);
        var pendingRequests  = await _db.Venues
            .CountAsync(v => v.ApprovalStatus == "PENDING");

        // 5 người dùng mới nhất
        var recentUsers = await _db.Users
            .Include(u => u.Roles)
            .OrderByDescending(u => u.CreatedAt)
            .Take(5)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.IsActive,
                u.CreatedAt,
                Roles = u.Roles.Select(r => r.Name).ToList()
            })
            .ToListAsync();

        // 5 yêu cầu chờ duyệt mới nhất (venue PENDING)
        var pendingVenues = await _db.Venues
            .Where(v => v.ApprovalStatus == "PENDING")
            .Include(v => v.OwnerUser)
            .OrderByDescending(v => v.CreatedAt)
            .Take(5)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.CreatedAt,
                OwnerName  = v.OwnerUser != null ? v.OwnerUser.FullName : null,
                OwnerEmail = v.OwnerUser != null ? v.OwnerUser.Email    : null
            })
            .ToListAsync();

        return Ok(new
        {
            totalUsers,
            activeVenues,
            todayBookings,
            pendingRequests,
            recentUsers,
            pendingVenues
        });
    }

    // =========================================================================
    // ACCOUNT MANAGEMENT — Quản lý Tài khoản
    // GET  api/admin/accounts
    // GET  api/admin/accounts/{userId}
    // POST api/admin/accounts/{userId}/block
    // POST api/admin/accounts/{userId}/unblock
    // =========================================================================

    /// <summary>
    /// Danh sách tất cả tài khoản, hỗ trợ search + filter role/status + phân trang.
    /// </summary>
    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts(
        [FromQuery] string? search,
        [FromQuery] string? role,        // ADMIN | MANAGER | PLAYER
        [FromQuery] string? status,      // active | blocked
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var query = _db.Users
            .Include(u => u.Roles)
            .AsQueryable();

        // Search by name or email
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(u =>
                u.FullName.Contains(kw) ||
                u.Email.Contains(kw));
        }

        // Filter by role
        if (!string.IsNullOrWhiteSpace(role))
        {
            var roleUpper = role.Trim().ToUpper();
            query = query.Where(u => u.Roles.Any(r => r.Name == roleUpper));
        }

        // Filter by status
        if (!string.IsNullOrWhiteSpace(status))
        {
            var isActive = status.Trim().ToLower() == "active";
            query = query.Where(u => u.IsActive == isActive);
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.PhoneNumber,
                u.IsActive,
                u.BlockedAt,
                u.BlockedReason,
                u.CreatedAt,
                Roles = u.Roles.Select(r => r.Name).ToList()
            })
            .ToListAsync();

        return Ok(new { totalItems, totalPages, page, pageSize, items });
    }

    /// <summary>
    /// Chi tiết một tài khoản.
    /// </summary>
    [HttpGet("accounts/{userId:guid}")]
    public async Task<IActionResult> GetAccount([FromRoute] Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại." });

        return Ok(new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.Gender,
            user.DateOfBirth,
            user.IsActive,
            user.BlockedAt,
            user.BlockedReason,
            user.CreatedAt,
            user.UpdatedAt,
            Roles = user.Roles.Select(r => r.Name).ToList()
        });
    }

    /// <summary>
    /// Khoá tài khoản người dùng. Body: { "reason": "..." }
    /// </summary>
    [HttpPost("accounts/{userId:guid}/block")]
    public async Task<IActionResult> BlockAccount(
        [FromRoute] Guid userId,
        [FromBody] BlockAccountRequest request)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được Admin." });

        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại." });

        if (user.IsActive == false)
            return BadRequest(new { message = "Tài khoản đã bị khoá trước đó." });

        // Không cho phép khoá chính Admin đang đăng nhập
        if (user.Id == adminId)
            return BadRequest(new { message = "Không thể khoá tài khoản của chính mình." });

        await _userService.BlockUserAsync(userId, adminId, request.Reason ?? "Vi phạm điều khoản.");

        return Ok(new { message = "Đã khoá tài khoản thành công.", userId });
    }

    /// <summary>
    /// Mở khoá tài khoản người dùng.
    /// </summary>
    [HttpPost("accounts/{userId:guid}/unblock")]
    public async Task<IActionResult> UnblockAccount([FromRoute] Guid userId)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại." });

        if (user.IsActive == true)
            return BadRequest(new { message = "Tài khoản đang hoạt động bình thường." });

        await _userService.UnblockUserAsync(userId);

        return Ok(new { message = "Đã mở khoá tài khoản thành công.", userId });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub)
                 ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
    }
}

// ── Request DTOs (inline — đơn giản, không cần file riêng) ────────────────────

public record BlockAccountRequest(string? Reason);

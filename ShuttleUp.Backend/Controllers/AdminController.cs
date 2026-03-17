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

    // =========================================================================
    // MANAGER REQUESTS — Duyệt Chủ Sân
    // GET  api/admin/manager-requests
    // POST api/admin/manager-requests/{requestId}/approve
    // POST api/admin/manager-requests/{requestId}/reject
    // =========================================================================

    /// <summary>
    /// Danh sách hồ sơ yêu cầu làm Chủ sân (có search, filter status, phân trang).
    /// </summary>
    [HttpGet("manager-requests")]
    public async Task<IActionResult> GetManagerRequests(
        [FromQuery] string? search,
        [FromQuery] string? status,      // PENDING | APPROVED | REJECTED
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var query = _db.ManagerProfiles
            .Include(m => m.User)
            .Include(m => m.AdminUser)
            .AsQueryable();

        // Filter status
        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusUpper = status.Trim().ToUpper();
            query = query.Where(r => r.Status == statusUpper);
        }

        // Search by name, email, tax code, id card,...
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(r => 
                (r.User != null && r.User.FullName.Contains(kw)) ||
                (r.User != null && r.User.Email.Contains(kw)) ||
                (r.IdCardNo != null && r.IdCardNo.Contains(kw)) ||
                (r.TaxCode != null && r.TaxCode.Contains(kw)) ||
                (r.BusinessLicenseNo != null && r.BusinessLicenseNo.Contains(kw))
            );
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        // Fetch data
        var rawItems = await query
            .OrderBy(r => r.Status == "PENDING" ? 0 : 1)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = rawItems.Select(r => new
        {
            Id = r.UserId, // Sử dụng user_id làm ID của Request
            r.Status,
            r.IdCardNo,
            r.TaxCode,
            r.BusinessLicenseNo,
            r.Address,
            OwnerName  = r.User?.FullName,
            OwnerEmail = r.User?.Email,
            RequestedAt= r.User?.CreatedAt,
            r.DecisionAt,
            r.DecisionNote,
            AdminName  = r.AdminUser?.FullName
        }).ToList();

        return Ok(new { totalItems, totalPages, page, pageSize, items });
    }

    /// <summary>
    /// Duyệt chủ sân. Body: { "note": "..." }
    /// </summary>
    [HttpPost("manager-requests/{userId:guid}/approve")]
    public async Task<IActionResult> ApproveRequest(
        [FromRoute] Guid userId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        var profile = await _db.ManagerProfiles
            .Include(p => p.User)
            .ThenInclude(u => u.Roles)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
            return NotFound(new { message = "Không tìm thấy hồ sơ yêu cầu này." });

        if (profile.Status != "PENDING")
            return BadRequest(new { message = $"Hồ sơ đã được xử lý ({profile.Status})." });

        // Update Request
        profile.Status = "APPROVED";
        profile.AdminUserId = adminId;
        profile.DecisionAt = DateTime.UtcNow;
        profile.DecisionNote = body.Note;

        // Add MANAGER role
        var managerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "MANAGER");
        if (managerRole != null && !profile.User.Roles.Any(r => r.Name == "MANAGER"))
        {
            profile.User.Roles.Add(managerRole);
        }
        
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã duyệt Cấp quyền Chủ sân thành công." });
    }

    /// <summary>
    /// Từ chối chủ sân. Body: { "note": "..." }
    /// </summary>
    [HttpPost("manager-requests/{userId:guid}/reject")]
    public async Task<IActionResult> RejectRequest(
        [FromRoute] Guid userId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        var profile = await _db.ManagerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile == null)
            return NotFound(new { message = "Không tìm thấy hồ sơ yêu cầu này." });

        if (profile.Status != "PENDING")
            return BadRequest(new { message = $"Hồ sơ đã được xử lý ({profile.Status})." });

        if (string.IsNullOrWhiteSpace(body.Note))
            return BadRequest(new { message = "Vui lòng nhập lý do từ chối." });

        // Update Request
        profile.Status = "REJECTED";
        profile.AdminUserId = adminId;
        profile.DecisionAt = DateTime.UtcNow;
        profile.DecisionNote = body.Note;
        
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã từ chối cấp quyền Chủ sân thành công." });
    }

    // =========================================================================
    // STATISTICS — Thống kê
    // GET api/admin/stats/bookings
    // GET api/admin/stats/revenue
    // =========================================================================

    [HttpGet("stats/bookings")]
    public async Task<IActionResult> GetBookingStats(
        [FromQuery] string? status,
        [FromQuery] string? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var totalBookings = await _db.Bookings.CountAsync();
        var confirmedBookings = await _db.Bookings.CountAsync(b => b.Status == "Confirmed");
        var pendingBookings = await _db.Bookings.CountAsync(b => b.Status == "Pending");
        var cancelledBookings = await _db.Bookings.CountAsync(b => b.Status == "Cancelled");

        // List and Filter
        var query = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Venue)
            .Include(b => b.BookingItems)
                .ThenInclude(bi => bi.Court)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(b => b.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(date))
        {
            // Simple string matching for dd/MM/yyyy date filter requested by frontend
            // In a real app we'd parse this into a date range, but we'll filter post-query for simplicity
        }

        var rawList = await query
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(date))
        {
            rawList = rawList.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value.ToString("dd/MM/yyyy").Contains(date)).ToList();
        }

        var totalItems = rawList.Count;
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var pagedItems = rawList
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new
            {
                id = $"BK{b.Id.ToString().Substring(0, 5).ToUpper()}",
                player = b.User?.FullName ?? "N/A",
                venue = b.Venue?.Name ?? "N/A",
                court = string.Join(", ", b.BookingItems.Select(bi => bi.Court?.Name)),
                date = b.CreatedAt?.ToString("dd/MM/yyyy"),
                time = b.BookingItems.FirstOrDefault() != null ? $"{b.BookingItems.First().StartTime:hh\\:mm}-{b.BookingItems.First().EndTime:hh\\:mm}" : "N/A",
                amount = $"{b.TotalAmount:N0} ₫",
                status = b.Status
            }).ToList();

        return Ok(new
        {
            summary = new
            {
                total = totalBookings,
                confirmed = confirmedBookings,
                pending = pendingBookings,
                cancelled = cancelledBookings
            },
            items = pagedItems,
            totalItems,
            totalPages
        });
    }

    [HttpGet("stats/revenue")]
    public async Task<IActionResult> GetRevenueStats()
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1);
        var startOfDay = now.Date;

        var confirmedBookings = _db.Bookings.Where(b => b.Status == "Confirmed");

        var totalRevenue = await confirmedBookings.SumAsync(b => b.TotalAmount ?? 0);
        var monthRevenue = await confirmedBookings.Where(b => b.CreatedAt >= startOfMonth).SumAsync(b => b.TotalAmount ?? 0);
        var todayRevenue = await confirmedBookings.Where(b => b.CreatedAt >= startOfDay).SumAsync(b => b.TotalAmount ?? 0);
        var activeVenuesCount = await _db.Venues.CountAsync(v => v.IsActive == true);

        // Group by Venue
        var venuesStats = await _db.Venues
            .Select(v => new
            {
                id = v.Id,
                venue = v.Name,
                owner = v.OwnerUser != null ? v.OwnerUser.FullName : "N/A",
                totalBookings = v.Bookings.Count(b => b.Status == "Confirmed"),
                revenue = v.Bookings.Where(b => b.Status == "Confirmed").Sum(b => b.TotalAmount ?? 0),
                growth = "+0%" // Simplified for now
            })
            .OrderByDescending(v => v.revenue)
            .ToListAsync();

        return Ok(new
        {
            summary = new
            {
                totalRevenue = $"{totalRevenue:N0} ₫",
                monthRevenue = $"{monthRevenue:N0} ₫",
                todayRevenue = $"{todayRevenue:N0} ₫",
                activeVenues = activeVenuesCount
            },
            venuesData = venuesStats
        });
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
public record ApprovalDecisionRequest(string? Note);

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using DalFile = ShuttleUp.DAL.Models.File;

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
    private readonly IBanService     _banService;
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public AdminController(
        IUserService    userService,
        IVenueService   venueService,
        IBookingService bookingService,
        IBanService     banService,
        ShuttleUpDbContext db,
        INotificationDispatchService notify)
    {
        _userService    = userService;
        _venueService   = venueService;
        _bookingService = bookingService;
        _banService     = banService;
        _db             = db;
        _notify         = notify;
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
        var pendingRequests  = await _db.ManagerProfileRequests
            .CountAsync(r => r.Status == "PENDING");

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

        // 5 yêu cầu chờ duyệt mới nhất
        var pendingVenues = await _db.ManagerProfileRequests
            .Where(r => r.Status == "PENDING")
            .Include(r => r.User)
            .OrderByDescending(r => r.RequestedAt)
            .Take(5)
            .Select(r => new
            {
                Id = r.Id,
                Name = string.IsNullOrWhiteSpace(r.TaxCode) ? "Cá nhân" : $"MST: {r.TaxCode}",
                Address = r.Address,
                CreatedAt = r.RequestedAt ?? r.User.CreatedAt,
                OwnerName = r.User.FullName,
                OwnerEmail = r.User.Email
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
                u.Gender,
                u.DateOfBirth,
                u.IsActive,
                u.BlockedAt,
                u.BlockedReason,
                u.BanType,
                u.SoftBanExpiresAt,
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
            user.BanType,
            user.SoftBanExpiresAt,
            user.CreatedAt,
            user.UpdatedAt,
            Roles = user.Roles.Select(r => r.Name).ToList()
        });
    }

    /// <summary>
    /// Kiểm tra kịch bản cấm tài khoản trước khi thực hiện.
    /// </summary>
    [HttpGet("accounts/{userId:guid}/ban-check")]
    public async Task<IActionResult> CheckBanScenario([FromRoute] Guid userId)
    {
        var result = await _banService.CheckBanScenarioAsync(userId);
        return Ok(new {
            scenario = result.Scenario.ToString(),
            ongoingBookingCount = result.OngoingBookingCount,
            isInGracePeriod = result.IsInGracePeriod,
            softBanExpiresAt = result.SoftBanExpiresAt
        });
    }

    /// <summary>
    /// Khoá tài khoản người dùng.
    /// </summary>
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

    /// <summary>
    /// Mở khoá tài khoản người dùng.
    /// </summary>
    [HttpPost("accounts/{userId:guid}/unblock")]
    public async Task<IActionResult> UnblockAccount(
        [FromRoute] Guid userId,
        [FromBody] UnblockAccountRequest request)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại." });

        if (user.IsActive == true && user.BanType != "SOFT")
            return BadRequest(new { message = "Tài khoản đang hoạt động bình thường." });

        user.IsActive = true;
        user.BanType = null;
        user.SoftBanExpiresAt = null;
        user.BlockedAt = null;
        user.BlockedBy = null;
        user.BlockedReason = null;

        await _userService.UpdateAsync(user);

        var bannedUserCache = HttpContext.RequestServices.GetRequiredService<IBannedUserCache>();
        bannedUserCache.Remove(userId);

        if (request.RestoreVenues)
        {
            var venues = await _db.Venues.Where(v => v.OwnerUserId == userId).ToListAsync();
            foreach (var v in venues) { v.IsActive = true; }
            await _db.SaveChangesAsync();
        }

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

        var query = _db.ManagerProfileRequests
            .Include(r => r.User)
            .Include(r => r.AdminUser)
            .AsQueryable();

        // Filter status
        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusUpper = status.Trim().ToUpper();
            query = query.Where(r => r.Status == statusUpper);
        }

        // Search by name, email, tax code, address...
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(r => 
                (r.User != null && r.User.FullName.Contains(kw)) ||
                (r.User != null && r.User.Email.Contains(kw)) ||
                (r.TaxCode != null && r.TaxCode.Contains(kw)) ||
                (r.Address != null && r.Address.Contains(kw))
            );
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        // Fetch data
        var rawItems = await query
            .OrderBy(r => r.Status == "PENDING" ? 0 : 1)
            .ThenByDescending(r => r.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var fileIds = rawItems
            .SelectMany(r => new Guid?[]
            {
                r.CccdFrontFileId,
                r.CccdBackFileId,
                r.BusinessLicenseFileId1,
                r.BusinessLicenseFileId2,
                r.BusinessLicenseFileId3
            })
            .Where(id => id != null)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var files = fileIds.Count == 0
            ? new List<DalFile>()
            : await _db.Files.AsNoTracking().Where(f => fileIds.Contains(f.Id)).ToListAsync();
        var fileDict = files.ToDictionary(f => f.Id, f => f);

        string? UrlOf(Guid? fileId) =>
            fileId != null && fileDict.TryGetValue(fileId.Value, out var f) ? f.FileUrl : null;

        string? MimeOf(Guid? fileId) =>
            fileId != null && fileDict.TryGetValue(fileId.Value, out var f) ? f.MimeType : null;

        var items = rawItems.Select(r => new
        {
            Id = r.Id,
            r.Status,
            RequestType = r.RequestType,
            r.TaxCode,
            r.Address,

            cccdFrontUrl = UrlOf(r.CccdFrontFileId),
            cccdBackUrl = UrlOf(r.CccdBackFileId),

            businessLicenseFiles = new[]
            {
                new { id = r.BusinessLicenseFileId1, url = UrlOf(r.BusinessLicenseFileId1), mimeType = MimeOf(r.BusinessLicenseFileId1) },
                new { id = r.BusinessLicenseFileId2, url = UrlOf(r.BusinessLicenseFileId2), mimeType = MimeOf(r.BusinessLicenseFileId2) },
                new { id = r.BusinessLicenseFileId3, url = UrlOf(r.BusinessLicenseFileId3), mimeType = MimeOf(r.BusinessLicenseFileId3) }
            }
            .Where(x => x.url != null)
            .Select(x => new { url = x.url, mimeType = x.mimeType, id = x.id })
            .ToList(),

            OwnerName = r.User?.FullName,
            OwnerEmail = r.User?.Email,
            RequestedAt = r.RequestedAt,

            r.DecisionAt,
            r.DecisionNote,
            AdminName = r.AdminUser?.FullName
        }).ToList();

        return Ok(new { totalItems, totalPages, page, pageSize, items });
    }

    /// <summary>
    /// Duyệt chủ sân. Body: { "note": "..." }
    /// </summary>
    [HttpPost("manager-requests/{requestId:guid}/approve")]
    public async Task<IActionResult> ApproveRequest(
        [FromRoute] Guid requestId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        var request = await _db.ManagerProfileRequests
            .Include(r => r.User)
            .ThenInclude(u => u.Roles)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
            return NotFound(new { message = "Không tìm thấy hồ sơ yêu cầu này." });

        if (request.Status != "PENDING")
            return BadRequest(new { message = $"Hồ sơ đã được xử lý ({request.Status})." });

        var now = DateTime.UtcNow;

        // Chặn duyệt theo loại đơn
        // - Đăng ký (DANG_KY): bắt buộc CCCD 2 mặt + ít nhất 1 giấy phép + tax code + address
        // - Cập nhật (CAP_NHAT): cho phép thiếu giấy tờ (chỉ cập nhật phần user gửi)
        var reqType = request.RequestType?.Trim().ToUpperInvariant();
        if (reqType == "DANG_KY")
        {
            var hasCccd = request.CccdFrontFileId != null && request.CccdBackFileId != null;
            var hasLicense =
                request.BusinessLicenseFileId1 != null ||
                request.BusinessLicenseFileId2 != null ||
                request.BusinessLicenseFileId3 != null;

            if (!hasCccd ||
                !hasLicense ||
                string.IsNullOrWhiteSpace(request.TaxCode) ||
                string.IsNullOrWhiteSpace(request.Address))
                return BadRequest(new { message = "Hồ sơ chưa đủ giấy tờ để duyệt." });
        }

        // Update Request (history)
        request.Status = "APPROVED";
        request.AdminUserId = adminId;
        request.DecisionAt = now;
        request.DecisionNote = body.Note;

        // Update Snapshot (manager_profiles)
        var snapshot = await _db.ManagerProfiles.FirstOrDefaultAsync(p => p.UserId == request.UserId);
        if (snapshot == null)
        {
            snapshot = new ManagerProfile { UserId = request.UserId };
            _db.ManagerProfiles.Add(snapshot);
        }

        // Chỉ ghi đè snapshot nếu request có field tương ứng (để CAP_NHAT không bị xóa ảnh cũ).
        if (!string.IsNullOrWhiteSpace(request.TaxCode))
            snapshot.TaxCode = request.TaxCode;
        if (!string.IsNullOrWhiteSpace(request.Address))
            snapshot.Address = request.Address;

        if (request.CccdFrontFileId != null)
            snapshot.CccdFrontFileId = request.CccdFrontFileId;
        if (request.CccdBackFileId != null)
            snapshot.CccdBackFileId = request.CccdBackFileId;

        // Cập nhật tất cả 3 slot giấy phép nếu ít nhất 1 slot có giá trị trong request.
        // Điều này cho phép CAP_NHAT xóa một số ảnh cũ (set về null) trong khi vẫn giữ ảnh còn lại.
        bool hasAnyLicenseInRequest =
            request.BusinessLicenseFileId1 != null ||
            request.BusinessLicenseFileId2 != null ||
            request.BusinessLicenseFileId3 != null;

        if (hasAnyLicenseInRequest)
        {
            snapshot.BusinessLicenseFileId1 = request.BusinessLicenseFileId1;
            snapshot.BusinessLicenseFileId2 = request.BusinessLicenseFileId2;
            snapshot.BusinessLicenseFileId3 = request.BusinessLicenseFileId3;
        }

        snapshot.Status = "APPROVED";
        snapshot.AdminUserId = adminId;
        snapshot.DecisionAt = now;
        snapshot.DecisionNote = body.Note;

        // Add MANAGER role (giữ role cho tới khi người dùng bị khoá/bị xoá role ở nơi khác)
        var managerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "MANAGER");
        if (managerRole != null && !request.User.Roles.Any(r => r.Name == "MANAGER"))
            request.User.Roles.Add(managerRole);

        await _db.SaveChangesAsync();

        // ── Notify user: hồ sơ đã được duyệt (SignalR + Email) ──
        await _notify.NotifyUserAsync(
            request.UserId,
            NotificationTypes.ManagerRequestApproved,
            "Hồ sơ Chủ sân đã được duyệt! 🎉",
            !string.IsNullOrWhiteSpace(body.Note)
                ? $"Ghi chú từ Admin: {body.Note}"
                : "Chúc mừng bạn đã trở thành Chủ sân trên ShuttleUp! Hãy bắt đầu thêm sân ngay nhé.",
            metadata: new { deepLink = "/manager/venues" },
            sendEmail: true);

        return Ok(new { message = "Đã duyệt Cấp quyền Chủ sân thành công." });
    }

    /// <summary>
    /// Từ chối chủ sân. Body: { "note": "..." }
    /// </summary>
    [HttpPost("manager-requests/{requestId:guid}/reject")]
    public async Task<IActionResult> RejectRequest(
        [FromRoute] Guid requestId,
        [FromBody] ApprovalDecisionRequest body)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty) return Unauthorized();

        var request = await _db.ManagerProfileRequests
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
            return NotFound(new { message = "Không tìm thấy hồ sơ yêu cầu này." });

        if (request.Status != "PENDING")
            return BadRequest(new { message = $"Hồ sơ đã được xử lý ({request.Status})." });

        if (string.IsNullOrWhiteSpace(body.Note))
            return BadRequest(new { message = "Vui lòng nhập lý do từ chối." });

        // Update Request (history only). Snapshot giữ nguyên để role MANAGER không mất khi user update bị reject.
        request.Status = "REJECTED";
        request.AdminUserId = adminId;
        request.DecisionAt = DateTime.UtcNow;
        request.DecisionNote = body.Note;
        
        await _db.SaveChangesAsync();

        // ── Notify user: hồ sơ bị từ chối (SignalR + Email) ──
        await _notify.NotifyUserAsync(
            request.UserId,
            NotificationTypes.ManagerRequestRejected,
            "Hồ sơ Chủ sân chưa được duyệt",
            $"Lý do: {body.Note?.Trim()}. Bạn có thể cập nhật lại hồ sơ và gửi lại.",
            metadata: new { deepLink = "/user/manager-info" },
            sendEmail: true);

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
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        // Build filtered query first (so summary cards match filters)
        var query = _db.Bookings
            .AsNoTracking()
            .Include(b => b.User)
            .Include(b => b.Venue)
            .Include(b => b.BookingItems)
                .ThenInclude(bi => bi.Court)
            .AsQueryable();

        // Status filter — normalise to uppercase
        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(b => b.Status == s);
        }

        // Date range filter at DB level
        // Interpret yyyy-MM-dd as Vietnam local day boundaries (UTC+7), then convert to UTC for DB compare.
        var vnTz = GetVietnamTimeZone();
        if (!string.IsNullOrWhiteSpace(startDate) &&
            DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var dtStartLocal))
        {
            var vnStart = DateTime.SpecifyKind(dtStartLocal.Date, DateTimeKind.Unspecified);
            var utcStart = TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
            query = query.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value >= utcStart);
        }

        if (!string.IsNullOrWhiteSpace(endDate) &&
            DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var dtEndLocal))
        {
            var vnEndExclusive = DateTime.SpecifyKind(dtEndLocal.Date.AddDays(1), DateTimeKind.Unspecified);
            var utcEndExclusive = TimeZoneInfo.ConvertTimeToUtc(vnEndExclusive, vnTz);
            query = query.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value < utcEndExclusive);
        }

        // Search by player name or venue name
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(b =>
                (b.User != null && b.User.FullName.Contains(kw)) ||
                (b.Venue != null && b.Venue.Name.Contains(kw)));
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        // Summary counts — uppercase statuses (filtered)
        var totalBookings = totalItems;
        var confirmedBookings = await query.CountAsync(b => b.Status == "CONFIRMED");
        var pendingBookings = await query.CountAsync(b => b.Status == "PENDING");
        var cancelledBookings = await query.CountAsync(b => b.Status == "CANCELLED");

        var pagedItems = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new
            {
                id        = "BK" + b.Id.ToString().Substring(0, 5).ToUpper(),
                bookingId = b.Id,
                player    = b.User != null ? b.User.FullName : "N/A",
                venue     = b.Venue != null ? b.Venue.Name : "N/A",
                court     = string.Join(", ", b.BookingItems.Select(bi => bi.Court != null ? bi.Court.Name : "")),
                date      = b.CreatedAt != null ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(b.CreatedAt.Value, DateTimeKind.Utc), vnTz).ToString("dd/MM/yyyy") : "",
                startTime = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi => bi.StartTime).FirstOrDefault(),
                endTime   = b.BookingItems.OrderByDescending(bi => bi.EndTime).Select(bi => bi.EndTime).FirstOrDefault(),
                amount    = b.TotalAmount ?? 0m,
                amountFmt = string.Format("{0:N0} ₫", b.TotalAmount ?? 0),
                status    = b.Status
            })
            .ToListAsync();

        return Ok(new
        {
            summary = new
            {
                total     = totalBookings,
                confirmed = confirmedBookings,
                pending   = pendingBookings,
                cancelled = cancelledBookings
            },
            items = pagedItems,
            totalItems,
            totalPages
        });
    }

    [HttpGet("stats/revenue")]
    public async Task<IActionResult> GetRevenueStats(
        [FromQuery] string? startDate,
        [FromQuery] string? endDate)
    {
        // Use Vietnam day/month boundaries (UTC+7) for "today" and "this month"
        var vnTz = GetVietnamTimeZone();
        var nowUtc = DateTime.UtcNow;
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTz);

        var vnStartOfDay = DateTime.SpecifyKind(nowVn.Date, DateTimeKind.Unspecified);
        var startOfDayUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfDay, vnTz);

        var vnStartOfMonth = DateTime.SpecifyKind(new DateTime(nowVn.Year, nowVn.Month, 1, 0, 0, 0), DateTimeKind.Unspecified);
        var startOfMonthUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfMonth, vnTz);

        var vnStartOfPrevMonth = DateTime.SpecifyKind(new DateTime(nowVn.Year, nowVn.Month, 1, 0, 0, 0).AddMonths(-1), DateTimeKind.Unspecified);
        var startOfPrevMonthUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfPrevMonth, vnTz);
        var endOfPrevMonthUtc = startOfMonthUtc;

        // Custom date range for venue breakdown (optional)
        DateTime? rangeStart = null, rangeEnd = null;
        if (!string.IsNullOrWhiteSpace(startDate) &&
            DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var _rs))
        {
            var vnStart = DateTime.SpecifyKind(_rs.Date, DateTimeKind.Unspecified);
            rangeStart = TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
        }

        if (!string.IsNullOrWhiteSpace(endDate) &&
            DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var _re))
        {
            var vnEndExclusive = DateTime.SpecifyKind(_re.Date.AddDays(1), DateTimeKind.Unspecified);
            rangeEnd = TimeZoneInfo.ConvertTimeToUtc(vnEndExclusive, vnTz);
        }

        var paidStatuses = new[] { "CONFIRMED", "COMPLETED" };

        var confirmedBase = _db.Bookings.Where(b => paidStatuses.Contains(b.Status));

        var totalRevenue = await confirmedBase.SumAsync(b => b.TotalAmount ?? 0);
        var monthRevenue = await confirmedBase.Where(b => b.CreatedAt >= startOfMonthUtc).SumAsync(b => b.TotalAmount ?? 0);
        var todayRevenue = await confirmedBase.Where(b => b.CreatedAt >= startOfDayUtc).SumAsync(b => b.TotalAmount ?? 0);
        var activeVenuesCount = await _db.Venues.CountAsync(v => v.IsActive == true);

        // Per-venue stats with real growth (this month vs prev month)
        var venuesRaw = await _db.Venues
            .Where(v => v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                venueName = v.Name,
                ownerName = v.OwnerUser != null ? v.OwnerUser.FullName : "N/A",
                totalBookings = v.Bookings.Count(b => paidStatuses.Contains(b.Status)),
                revenueRaw    = v.Bookings
                    .Where(b => paidStatuses.Contains(b.Status)
                             && (rangeStart == null || b.CreatedAt >= rangeStart)
                             && (rangeEnd   == null || b.CreatedAt <  rangeEnd))
                    .Sum(b => b.TotalAmount ?? 0),
                thisMonthRevenue = v.Bookings
                    .Where(b => paidStatuses.Contains(b.Status) && b.CreatedAt >= startOfMonthUtc)
                    .Sum(b => b.TotalAmount ?? 0),
                prevMonthRevenue = v.Bookings
                    .Where(b => paidStatuses.Contains(b.Status)
                             && b.CreatedAt >= startOfPrevMonthUtc && b.CreatedAt < endOfPrevMonthUtc)
                    .Sum(b => b.TotalAmount ?? 0),
            })
            .OrderByDescending(v => v.revenueRaw)
            .ToListAsync();

        var venuesStats = venuesRaw.Select(v =>
        {
            string growth;
            if (v.prevMonthRevenue == 0)
                growth = v.thisMonthRevenue > 0 ? "+100%" : "0%";
            else
            {
                var pct = (v.thisMonthRevenue - v.prevMonthRevenue) / v.prevMonthRevenue * 100m;
                growth = (pct >= 0 ? "+" : "") + Math.Round(pct, 1).ToString("0.#") + "%";
            }
            return new
            {
                id            = v.Id,
                venue         = v.venueName,
                owner         = v.ownerName,
                totalBookings = v.totalBookings,
                revenue       = v.revenueRaw,
                thisMonthRevenue = v.thisMonthRevenue,
                prevMonthRevenue = v.prevMonthRevenue,
                growth
            };
        }).ToList();

        return Ok(new
        {
            summary = new
            {
                totalRevenue  = $"{totalRevenue:N0} ₫",
                monthRevenue  = $"{monthRevenue:N0} ₫",
                todayRevenue  = $"{todayRevenue:N0} ₫",
                activeVenues  = activeVenuesCount
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

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        // Windows: "SE Asia Standard Time"; Linux: "Asia/Ho_Chi_Minh"
        try { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
    }
}

// ── Request DTOs (inline — đơn giản, không cần file riêng) ────────────────────

public record ApprovalDecisionRequest(string? Note);
public record BanAccountRequest(string? Reason, bool ForceHardBan);
public record UnblockAccountRequest(bool RestoreVenues);

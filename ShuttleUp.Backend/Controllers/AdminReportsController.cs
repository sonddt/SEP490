using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "ADMIN")]
public class AdminReportsController : ControllerBase
{
    private const int RefundSlaDays = 7;

    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public AdminReportsController(ShuttleUpDbContext db, INotificationDispatchService notify)
    {
        _db = db;
        _notify = notify;
    }

    public record UpdateReportRequest(
        string Status,
        string? AdminAction,
        string? AdminNote);

    [HttpGet]
    public async Task<IActionResult> GetReports(
        [FromQuery] string? targetType,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool overdueRefund = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var now = DateTime.UtcNow;
        var query = _db.ViolationReports.AsNoTracking()
            .Include(r => r.ReporterUser)
            .Include(r => r.AdminUser)
            .Include(r => r.Files)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(targetType) && targetType.Trim().ToUpperInvariant() != "ALL")
        {
            var tt = targetType.Trim().ToUpperInvariant();
            query = query.Where(r => r.TargetType == tt);
        }

        if (!string.IsNullOrWhiteSpace(status) && status.Trim().ToUpperInvariant() != "ALL")
        {
            var st = status.Trim().ToUpperInvariant();
            query = query.Where(r => r.Status == st);
        }

        if (overdueRefund)
        {
            query = query.Where(r =>
                r.Status == "REFUND_PENDING" &&
                r.RefundDeadlineAt != null &&
                r.RefundDeadlineAt < now);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(r =>
                (r.Reason != null && r.Reason.Contains(kw)) ||
                (r.Description != null && r.Description.Contains(kw)) ||
                (r.ReporterUser != null && r.ReporterUser.FullName.Contains(kw)));
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderBy(r => r.Status == "PENDING" ? 0 : r.Status == "REVIEWING" ? 1 : r.Status == "REFUND_PENDING" ? 2 : r.Status == "RESOLVED" ? 3 : 4)
            .ThenBy(r => r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                id = r.Id,
                targetType = r.TargetType,
                targetId = r.TargetId,
                reason = r.Reason,
                description = r.Description,
                status = r.Status,
                createdAt = r.CreatedAt,
                reporter = r.ReporterUser != null ? new { id = r.ReporterUser.Id, fullName = r.ReporterUser.FullName, email = r.ReporterUser.Email } : null,
                admin = r.AdminUser != null ? new { id = r.AdminUser.Id, fullName = r.AdminUser.FullName } : null,
                adminAction = r.AdminAction,
                adminNote = r.AdminNote,
                decisionAt = r.DecisionAt,
                refundDeadlineAt = r.RefundDeadlineAt,
                refundOverdue = r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now,
                fileUrls = r.Files.Select(f => f.FileUrl).ToList()
            })
            .ToListAsync();

        return Ok(new { totalItems, totalPages, page, pageSize, items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetReportDetail([FromRoute] Guid id)
    {
        var now = DateTime.UtcNow;
        var r = await _db.ViolationReports.AsNoTracking()
            .Include(x => x.ReporterUser)
            .Include(x => x.AdminUser)
            .Include(x => x.Files)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r == null) return NotFound(new { message = "Không tìm thấy report." });

        var refundOverdue = r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now;

        return Ok(new
        {
            id = r.Id,
            targetType = r.TargetType,
            targetId = r.TargetId,
            reason = r.Reason,
            description = r.Description,
            status = r.Status,
            createdAt = r.CreatedAt,
            reporter = r.ReporterUser != null ? new { id = r.ReporterUser.Id, fullName = r.ReporterUser.FullName, email = r.ReporterUser.Email } : null,
            admin = r.AdminUser != null ? new { id = r.AdminUser.Id, fullName = r.AdminUser.FullName } : null,
            adminAction = r.AdminAction,
            adminNote = r.AdminNote,
            decisionAt = r.DecisionAt,
            refundDeadlineAt = r.RefundDeadlineAt,
            refundOverdue,
            fileUrls = r.Files.Select(f => f.FileUrl).ToList(),
        });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateReport([FromRoute] Guid id, [FromBody] UpdateReportRequest body, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Unauthorized();

        var report = await _db.ViolationReports
            .Include(r => r.ReporterUser)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (report == null) return NotFound(new { message = "Không tìm thấy report." });

        var prevStatus = report.Status?.Trim().ToUpperInvariant();
        var status = (body.Status ?? "").Trim().ToUpperInvariant();
        if (status is not ("PENDING" or "REVIEWING" or "REFUND_PENDING" or "RESOLVED" or "REJECTED"))
            return BadRequest(new { message = "Trạng thái không hợp lệ." });

        var action = (body.AdminAction ?? "").Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(action) && action is not ("WARN_USER" or "LOCK_USER" or "WARN_VENUE" or "LOCK_VENUE" or "REMOVE_POST" or "REFUND" or "NO_ACTION"))
            return BadRequest(new { message = "Hành động admin không hợp lệ." });

        if (string.IsNullOrWhiteSpace(action))
            action = "NO_ACTION";

        if (status == "REFUND_PENDING")
        {
            if (!string.Equals(report.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Trạng thái \"Chờ hoàn tiền\" chỉ dùng cho khiếu nại đặt sân (BOOKING)." });
            if (action != "REFUND")
                return BadRequest(new { message = "Khi chọn chờ hoàn tiền, hành động phải là \"Hoàn tiền (thủ công)\"." });
        }

        if (string.Equals(report.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase) &&
            status == "RESOLVED" &&
            action == "REFUND" &&
            !string.Equals(prevStatus, "REFUND_PENDING", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "Với khiếu nại đặt sân: trước tiên lưu trạng thái \"Chờ hoàn tiền\", sau khi chủ sân đã hoàn xong mới chuyển \"Đã xử lý\". Có thể đổi hành động sang \"Không hành động\" nếu chỉ đóng hồ sơ."
            });
        }

        var enteredRefundPending = status == "REFUND_PENDING" && !string.Equals(prevStatus, "REFUND_PENDING", StringComparison.OrdinalIgnoreCase);

        report.Status = status;
        report.AdminUserId = adminId;
        report.AdminAction = action;
        report.AdminNote = string.IsNullOrWhiteSpace(body.AdminNote) ? null : body.AdminNote.Trim();
        report.DecisionAt = status is "RESOLVED" or "REJECTED" ? DateTime.UtcNow : null;

        if (enteredRefundPending)
        {
            report.RefundDeadlineAt = DateTime.UtcNow.AddDays(RefundSlaDays);
            await NotifyRefundPendingAsync(report, cancellationToken);
        }
        else if (status != "REFUND_PENDING")
        {
            report.RefundDeadlineAt = null;
        }

        if (status == "RESOLVED" && !string.IsNullOrWhiteSpace(report.AdminAction))
            await ApplyActionAsync(report.AdminAction!, report, cancellationToken);

        if (status is "RESOLVED" or "REJECTED")
            await NotifyReportOutcomeAsync(report, cancellationToken);
        
        if (status == "RESOLVED")
            await NotifyTargetUserAsync(report, cancellationToken);

        // --- GHI LOG LỊCH SỬ ---
        var log = new ViolationReportLog
        {
            Id = Guid.NewGuid(),
            ReportId = report.Id,
            AdminUserId = adminId,
            Status = status,
            AdminAction = action,
            AdminNote = report.AdminNote,
            CreatedAt = DateTime.UtcNow
        };
        _db.ViolationReportLogs.Add(log);
        // -----------------------

        await _db.SaveChangesAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var refundOverdue = report.Status == "REFUND_PENDING" && report.RefundDeadlineAt != null && report.RefundDeadlineAt < now;

        return Ok(new
        {
            message = "Đã cập nhật report.",
            report = new
            {
                id = report.Id,
                status = report.Status,
                adminAction = report.AdminAction,
                adminNote = report.AdminNote,
                decisionAt = report.DecisionAt,
                refundDeadlineAt = report.RefundDeadlineAt,
                refundOverdue,
            }
        });
    }

    private async Task NotifyRefundPendingAsync(ViolationReport report, CancellationToken cancellationToken)
    {
        if (!string.Equals(report.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase) ||
            report.TargetId == null || report.TargetId == Guid.Empty)
            return;

        var booking = await _db.Bookings.AsNoTracking()
            .Include(b => b.Venue)
            .FirstOrDefaultAsync(b => b.Id == report.TargetId, cancellationToken);
        if (booking == null) return;

        var deadline = report.RefundDeadlineAt ?? DateTime.UtcNow.AddDays(RefundSlaDays);
        var deadlineStr = FormatDeadlineVn(deadline);
        var meta = new { reportId = report.Id, bookingId = booking.Id, refundDeadlineAt = deadline };

        if (report.ReporterUserId is Guid rid && rid != Guid.Empty)
        {
            await _notify.NotifyUserAsync(
                rid,
                NotificationTypes.DisputeRefundPendingPlayer,
                "Khiếu nại đặt sân: cần hoàn tiền",
                $"Admin đã yêu cầu chủ sân xử lý hoàn tiền thủ công cho đơn của bạn. Hạn xử lý gợi ý: {deadlineStr}. Bạn sẽ thấy trạng thái cập nhật khi hồ sơ được đóng.",
                meta,
                cancellationToken: cancellationToken);
        }

        var ownerId = booking.Venue?.OwnerUserId;
        if (ownerId is Guid oid && oid != Guid.Empty)
        {
            await _notify.NotifyUserAsync(
                oid,
                NotificationTypes.DisputeRefundPendingManager,
                "Cần hoàn tiền theo khiếu nại đặt sân",
                $"Admin yêu cầu bạn hoàn tiền thủ công cho đơn liên quan. Hạn gợi ý: {deadlineStr}. Vui lòng xử lý và giữ biên lai chuyển khoản.",
                meta,
                cancellationToken: cancellationToken);
        }
    }

    private async Task NotifyReportOutcomeAsync(ViolationReport report, CancellationToken cancellationToken)
    {
        if (report.ReporterUserId == null || report.ReporterUserId == Guid.Empty) return;

        var isResolved = string.Equals(report.Status, "RESOLVED", StringComparison.OrdinalIgnoreCase);
        var type = isResolved ? NotificationTypes.ReportResolved : NotificationTypes.ReportRejected;
        var title = isResolved ? "Báo cáo của bạn đã được xử lý" : "Báo cáo của bạn đã bị từ chối";

        var actionText = report.AdminAction switch
        {
            "WARN_USER" or "WARN_VENUE" => "Cảnh báo đối tượng",
            "LOCK_USER" or "LOCK_VENUE" => "Khóa tài khoản/sân vi phạm",
            "REMOVE_POST" => "Gỡ bài đăng vi phạm",
            "REFUND" => "Yêu cầu hoàn tiền",
            _ => "Không có hành động bổ sung"
        };

        var body = isResolved
            ? $"Admin đã xử lý báo cáo về {report.TargetType}. Hành động: {actionText}. Ghi chú: {report.AdminNote ?? "Đã hoàn thành hồ sơ."}"
            : $"Báo cáo của bạn đã bị từ chối. Lý do: {report.AdminNote ?? "Không đủ bằng chứng hoặc không vi phạm quy định."}";

        var meta = new
        {
            reportId = report.Id,
            targetType = report.TargetType,
            targetId = report.TargetId,
            status = report.Status,
            adminAction = report.AdminAction
        };

        await _notify.NotifyUserAsync(
            report.ReporterUserId.Value,
            type,
            title,
            body,
            meta,
            cancellationToken: cancellationToken);
    }

    private static string FormatDeadlineVn(DateTime utcDeadline)
    {
        var tz = TryVietnamTimeZone();
        if (tz != null)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcDeadline, DateTimeKind.Utc), tz);
            return local.ToString("dd/MM/yyyy HH:mm", CultureInfo.GetCultureInfo("vi-VN")) + " (giờ Việt Nam)";
        }

        return utcDeadline.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture) + " UTC";
    }

    private static TimeZoneInfo? TryVietnamTimeZone()
    {
        foreach (var id in new[] { "Asia/Ho_Chi_Minh", "SE Asia Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                /* try next */
            }
            catch (InvalidTimeZoneException)
            {
                /* try next */
            }
        }

        return null;
    }

    private async Task ApplyActionAsync(string action, ViolationReport report, CancellationToken cancellationToken)
    {
        if (report.TargetId == null || report.TargetId == Guid.Empty) return;

        switch (action)
        {
            case "LOCK_USER":
                Guid? userIdToLock = null;
                if (report.TargetType == "USER")
                {
                    userIdToLock = report.TargetId;
                }
                else if (report.TargetType == "VENUE")
                {
                    var venue = await _db.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == report.TargetId, cancellationToken);
                    userIdToLock = venue?.OwnerUserId;
                }
                else if (report.TargetType == "MATCHING_POST")
                {
                    var post = await _db.MatchingPosts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == report.TargetId, cancellationToken);
                    userIdToLock = post?.CreatorUserId;
                }
                else if (report.TargetType == "BOOKING")
                {
                    var booking = await _db.Bookings.AsNoTracking().Include(b => b.Venue).FirstOrDefaultAsync(b => b.Id == report.TargetId, cancellationToken);
                    userIdToLock = booking?.Venue?.OwnerUserId;
                }

                if (userIdToLock != null && userIdToLock != Guid.Empty)
                {
                    var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userIdToLock, cancellationToken);
                    if (user != null)
                    {
                        user.IsActive = false;
                        user.BlockedAt = DateTime.UtcNow;
                        user.BlockedReason = report.AdminNote ?? $"Khoá tài khoản do vi phạm liên quan đến {report.TargetType}: {report.Reason}";
                    }
                }

                break;

            case "REMOVE_POST":
                if (report.TargetType == "MATCHING_POST")
                {
                    var post = await _db.MatchingPosts.FirstOrDefaultAsync(p => p.Id == report.TargetId, cancellationToken);
                    if (post != null) post.Status = "INACTIVE";
                }

                break;
            // WARN_USER / REFUND / NO_ACTION: không tác động DB tự động (chỉ gửi thông báo qua NotifyTargetUserAsync)
        }
    }

    private async Task NotifyTargetUserAsync(ViolationReport report, CancellationToken cancellationToken)
    {
        if (report.TargetId == null || report.TargetId == Guid.Empty || string.IsNullOrWhiteSpace(report.AdminAction) || report.AdminAction == "NO_ACTION")
            return;

        Guid? targetUserId = null;
        var targetLabel = "";

        switch (report.TargetType?.ToUpperInvariant())
        {
            case "USER":
                targetUserId = report.TargetId;
                targetLabel = "tài khoản";
                break;
            case "VENUE":
                var venue = await _db.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == report.TargetId, cancellationToken);
                targetUserId = venue?.OwnerUserId;
                targetLabel = $"sân ({venue?.Name})";
                break;
            case "MATCHING_POST":
                var post = await _db.MatchingPosts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == report.TargetId, cancellationToken);
                targetUserId = post?.CreatorUserId;
                targetLabel = "bài đăng ghép sân";
                break;
            case "BOOKING":
                var booking = await _db.Bookings.AsNoTracking().Include(b => b.Venue).FirstOrDefaultAsync(b => b.Id == report.TargetId, cancellationToken);
                targetUserId = booking?.Venue?.OwnerUserId;
                targetLabel = "đơn đặt sân";
                break;
        }

        if (targetUserId == null || targetUserId == Guid.Empty) return;

        var actionText = report.AdminAction switch
        {
            "WARN_USER" or "WARN_VENUE" => "Cảnh báo vi phạm quy định",
            "LOCK_USER" or "LOCK_VENUE" => "Tạm khóa hoạt động do vi phạm nghiêm trọng",
            "REMOVE_POST" => "Gỡ bài đăng vi phạm chính sách",
            "REFUND" => "Yêu cầu hoàn trả tiền cho khách hàng",
            _ => "Xử lý vi phạm"
        };

        var title = "Thông báo xử lý vi phạm";
        var body = $"Hệ thống đã ghi nhận báo cáo hợp lệ và thực hiện xử lý đối với {targetLabel} của bạn. Hành động: {actionText}. Ghi chú từ Admin: {report.AdminNote ?? "Vui lòng tuân thủ quy định của hệ thống."}";

        await _notify.NotifyUserAsync(
            targetUserId.Value,
            NotificationTypes.ReportTargetAction,
            title,
            body,
            new { reportId = report.Id, targetType = report.TargetType, targetId = report.TargetId },
            cancellationToken: cancellationToken);
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetHistory(Guid id, CancellationToken cancellationToken)
    {
        var logs = await _db.ViolationReportLogs
            .AsNoTracking()
            .Include(l => l.AdminUser)
            .Where(l => l.ReportId == id)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.CreatedAt,
                l.Status,
                l.AdminAction,
                l.AdminNote,
                AdminName = l.AdminUser.FullName
            })
            .ToListAsync(cancellationToken);

        return Ok(logs);
    }

    private bool TryGetAdminId(out Guid adminId)
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        adminId = Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
        return adminId != Guid.Empty;
    }
}

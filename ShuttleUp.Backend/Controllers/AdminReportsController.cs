using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Helpers;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "ADMIN")]
public class AdminReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly INotificationDispatchService _notify;
    private readonly IBanService _banService;

    public AdminReportsController(IReportService reportService, INotificationDispatchService notify, IBanService banService)
    {
        _reportService = reportService; _notify = notify; _banService = banService;
    }

    public record UpdateReportRequest(string Status, string? AdminAction, string? AdminNote);

    [HttpGet]
    public async Task<IActionResult> GetReports([FromQuery] string? targetType, [FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] bool overdueRefund = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _reportService.GetReportsPagedAsync(targetType, status, search, overdueRefund, page, pageSize));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetReportDetail([FromRoute] Guid id)
    {
        var result = await _reportService.GetReportDetailAsync(id);
        return result == null ? NotFound(new { message = "Không tìm thấy report." }) : Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateReport([FromRoute] Guid id, [FromBody] UpdateReportRequest body, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Unauthorized();
        try
        {
            var result = await _reportService.UpdateReportAsync(id, adminId, body.Status, body.AdminAction, body.AdminNote);

            // ── Cross-cutting: LOCK_USER ban logic ──
            if (result.Status == "RESOLVED" && result.AdminAction == "LOCK_USER" && result.TargetId != null)
            {
                var userIdToLock = await _reportService.ResolveTargetOwnerAsync(result.TargetType, result.TargetId.Value);
                if (userIdToLock != null && userIdToLock != Guid.Empty)
                {
                    var reason = result.AdminNote ?? $"Vi phạm liên quan đến {result.TargetType}: {result.Reason}";
                    var scenario = await _banService.CheckBanScenarioAsync(userIdToLock.Value);
                    if (scenario.Scenario == BanScenario.GracePeriod)
                        await _banService.ExecuteSoftBanAsync(userIdToLock.Value, adminId, reason);
                    else
                        await _banService.ExecuteHardBanAsync(userIdToLock.Value, adminId, reason);
                }
            }

            // ── Cross-cutting: Notifications ──
            if (result.EnteredRefundPending) await NotifyRefundPendingAsync(result, cancellationToken);
            if (result.Status is "RESOLVED" or "REJECTED") await NotifyReportOutcomeAsync(result, cancellationToken);
            if (result.Status == "RESOLVED") await NotifyTargetUserAsync(result, cancellationToken);

            return Ok(new
            {
                message = "Đã cập nhật report.",
                report = new { id = result.ReportId, status = result.Status, adminAction = result.AdminAction, adminNote = result.AdminNote, decisionAt = result.DecisionAt, refundDeadlineAt = result.RefundDeadlineAt, refundOverdue = result.RefundOverdue }
            });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetHistory(Guid id, CancellationToken cancellationToken)
        => Ok(await _reportService.GetReportHistoryAsync(id));

    // ── Notification helpers (Controller-level cross-cutting) ──

    private async Task NotifyRefundPendingAsync(ReportUpdateResult result, CancellationToken ct)
    {
        if (!string.Equals(result.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase) || result.TargetId == null) return;
        var venueInfo = await _reportService.GetBookingVenueInfoAsync(result.TargetId.Value);
        if (venueInfo == null) return;
        var deadline = result.RefundDeadlineAt ?? DateTime.UtcNow.AddDays(7);
        var deadlineStr = TimeZoneHelper.FormatDeadlineVn(deadline);
        var meta = new { reportId = result.ReportId, bookingId = result.TargetId, refundDeadlineAt = deadline };

        if (result.ReporterUserId is Guid rid && rid != Guid.Empty)
            await _notify.NotifyUserAsync(rid, NotificationTypes.DisputeRefundPendingPlayer, "Khiếu nại đặt sân: cần hoàn tiền",
                $"Admin đã yêu cầu chủ sân xử lý hoàn tiền thủ công cho đơn của bạn. Hạn xử lý gợi ý: {deadlineStr}.", meta, cancellationToken: ct);
        if (venueInfo.Value.venueOwnerId is Guid oid && oid != Guid.Empty)
            await _notify.NotifyUserAsync(oid, NotificationTypes.DisputeRefundPendingManager, "Cần hoàn tiền theo khiếu nại đặt sân",
                $"Admin yêu cầu bạn hoàn tiền thủ công cho đơn liên quan. Hạn gợi ý: {deadlineStr}.", meta, cancellationToken: ct);
    }

    private async Task NotifyReportOutcomeAsync(ReportUpdateResult result, CancellationToken ct)
    {
        if (result.ReporterUserId == null || result.ReporterUserId == Guid.Empty) return;
        var isResolved = result.Status == "RESOLVED";
        var type = isResolved ? NotificationTypes.ReportResolved : NotificationTypes.ReportRejected;
        var title = isResolved ? "Báo cáo của bạn đã được xử lý" : "Báo cáo của bạn đã bị từ chối";
        var actionText = result.AdminAction switch
        {
            "WARN_USER" or "WARN_VENUE" => "Cảnh báo đối tượng", "LOCK_USER" or "LOCK_VENUE" => "Khóa tài khoản/sân vi phạm",
            "REMOVE_POST" => "Gỡ bài đăng vi phạm", "REFUND" => "Yêu cầu hoàn tiền", _ => "Không có hành động bổ sung"
        };
        var body = isResolved ? $"Admin đã xử lý báo cáo về {result.TargetType}. Hành động: {actionText}. Ghi chú: {result.AdminNote ?? "Đã hoàn thành hồ sơ."}"
            : $"Báo cáo của bạn đã bị từ chối. Lý do: {result.AdminNote ?? "Không đủ bằng chứng hoặc không vi phạm quy định."}";
        await _notify.NotifyUserAsync(result.ReporterUserId.Value, type, title, body,
            new { reportId = result.ReportId, targetType = result.TargetType, targetId = result.TargetId, status = result.Status, adminAction = result.AdminAction }, cancellationToken: ct);
    }

    private async Task NotifyTargetUserAsync(ReportUpdateResult result, CancellationToken ct)
    {
        if (result.TargetId == null || string.IsNullOrWhiteSpace(result.AdminAction) || result.AdminAction == "NO_ACTION") return;
        var targetUserId = await _reportService.ResolveTargetOwnerAsync(result.TargetType, result.TargetId.Value);
        if (targetUserId == null || targetUserId == Guid.Empty) return;
        var targetName = await _reportService.ResolveTargetNameAsync(result.TargetType, result.TargetId);
        var targetLabel = result.TargetType?.ToUpperInvariant() switch { "USER" => "tài khoản", "VENUE" => $"sân ({targetName})", "MATCHING_POST" => "bài đăng ghép sân", "BOOKING" => "đơn đặt sân", _ => "mục" };
        var actionText = result.AdminAction switch { "WARN_USER" or "WARN_VENUE" => "Cảnh báo vi phạm quy định", "LOCK_USER" or "LOCK_VENUE" => "Tạm khóa hoạt động do vi phạm nghiêm trọng", "REMOVE_POST" => "Gỡ bài đăng vi phạm chính sách", "REFUND" => "Yêu cầu hoàn trả tiền cho khách hàng", _ => "Xử lý vi phạm" };
        await _notify.NotifyUserAsync(targetUserId.Value, NotificationTypes.ReportTargetAction, "Thông báo xử lý vi phạm",
            $"Hệ thống đã ghi nhận báo cáo hợp lệ và thực hiện xử lý đối với {targetLabel} của bạn. Hành động: {actionText}. Ghi chú từ Admin: {result.AdminNote ?? "Vui lòng tuân thủ quy định của hệ thống."}",
            new { reportId = result.ReportId, targetType = result.TargetType, targetId = result.TargetId }, cancellationToken: ct);
    }

    private bool TryGetAdminId(out Guid adminId)
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        adminId = Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
        return adminId != Guid.Empty;
    }
}

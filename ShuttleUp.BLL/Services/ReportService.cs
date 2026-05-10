using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class ReportService : IReportService
{
    private const int RefundSlaDays = 7;
    private readonly IViolationReportRepository _reportRepo;

    public ReportService(IViolationReportRepository reportRepo)
    {
        _reportRepo = reportRepo;
    }

    public async Task<object> GetReportsPagedAsync(string? targetType, string? status, string? search, bool overdueRefund, int page, int pageSize)
    {
        if (page <= 0) page = 1; if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var (totalItems, rawItems) = await _reportRepo.GetReportsPagedAsync(targetType, status, search, overdueRefund, (page - 1) * pageSize, pageSize);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var now = DateTime.UtcNow;

        var targetNames = await _reportRepo.ResolveTargetNamesAsync(
            rawItems.Select(i => (i.TargetType ?? "", i.TargetId ?? Guid.Empty)).ToList());

        var items = rawItems.Select(r => new
        {
            id = r.Id, targetType = r.TargetType, targetId = r.TargetId,
            targetName = targetNames.TryGetValue((r.TargetType ?? "", r.TargetId ?? Guid.Empty), out var tn) ? tn : null,
            reason = r.Reason, description = r.Description, status = r.Status, createdAt = r.CreatedAt,
            reporter = r.ReporterUser != null ? new { id = r.ReporterUser.Id, fullName = r.ReporterUser.FullName, email = r.ReporterUser.Email } : null,
            admin = r.AdminUser != null ? new { id = r.AdminUser.Id, fullName = r.AdminUser.FullName } : null,
            adminAction = r.AdminAction, adminNote = r.AdminNote, decisionAt = r.DecisionAt, refundDeadlineAt = r.RefundDeadlineAt,
            refundOverdue = r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now,
            fileUrls = (r.Files ?? (ICollection<DAL.Models.File>)new List<DAL.Models.File>()).Select(f => f.FileUrl).ToList()
        }).ToList();

        return new { totalItems, totalPages, page, pageSize, items };
    }

    public async Task<object?> GetReportDetailAsync(Guid id)
    {
        var r = await _reportRepo.GetDetailAsync(id);
        if (r == null) return null;
        var now = DateTime.UtcNow;
        var targetName = await _reportRepo.ResolveTargetNameAsync(r.TargetType, r.TargetId);
        return new
        {
            id = r.Id, targetType = r.TargetType, targetId = r.TargetId, targetName,
            reason = r.Reason, description = r.Description, status = r.Status, createdAt = r.CreatedAt,
            reporter = r.ReporterUser != null ? new { id = r.ReporterUser.Id, fullName = r.ReporterUser.FullName, email = r.ReporterUser.Email } : null,
            admin = r.AdminUser != null ? new { id = r.AdminUser.Id, fullName = r.AdminUser.FullName } : null,
            adminAction = r.AdminAction, adminNote = r.AdminNote, decisionAt = r.DecisionAt, refundDeadlineAt = r.RefundDeadlineAt,
            refundOverdue = r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now,
            fileUrls = (r.Files ?? (ICollection<DAL.Models.File>)new List<DAL.Models.File>()).Select(f => f.FileUrl).ToList()
        };
    }

    public async Task<ReportUpdateResult> UpdateReportAsync(Guid reportId, Guid adminId, string statusRaw, string? adminAction, string? adminNote)
    {
        var report = await _reportRepo.GetWithReporterAsync(reportId) ?? throw new KeyNotFoundException("Không tìm thấy report.");

        var prevStatus = report.Status?.Trim().ToUpperInvariant();
        var status = (statusRaw ?? "").Trim().ToUpperInvariant();
        if (status is not ("PENDING" or "REVIEWING" or "REFUND_PENDING" or "RESOLVED" or "REJECTED"))
            throw new InvalidOperationException("Trạng thái không hợp lệ.");

        var action = (adminAction ?? "").Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(action) && action is not ("WARN_USER" or "LOCK_USER" or "WARN_VENUE" or "LOCK_VENUE" or "REMOVE_POST" or "REFUND" or "NO_ACTION"))
            throw new InvalidOperationException("Hành động admin không hợp lệ.");
        if (string.IsNullOrWhiteSpace(action)) action = "NO_ACTION";

        if (status == "REFUND_PENDING")
        {
            if (!string.Equals(report.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Trạng thái \"Chờ hoàn tiền\" chỉ dùng cho khiếu nại đặt sân.");
            if (action != "REFUND") throw new InvalidOperationException("Khi chọn chờ hoàn tiền, hành động phải là \"Hoàn tiền\".");
        }
        if (string.Equals(report.TargetType, "BOOKING", StringComparison.OrdinalIgnoreCase) && status == "RESOLVED" && action == "REFUND" && !string.Equals(prevStatus, "REFUND_PENDING", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Trước tiên lưu trạng thái \"Chờ hoàn tiền\", sau khi chủ sân đã hoàn xong mới chuyển \"Đã xử lý\".");

        var enteredRefundPending = status == "REFUND_PENDING" && !string.Equals(prevStatus, "REFUND_PENDING", StringComparison.OrdinalIgnoreCase);

        report.Status = status; report.AdminUserId = adminId; report.AdminAction = action;
        report.AdminNote = string.IsNullOrWhiteSpace(adminNote) ? null : adminNote.Trim();
        report.DecisionAt = status is "RESOLVED" or "REJECTED" ? DateTime.UtcNow : null;
        if (enteredRefundPending) report.RefundDeadlineAt = DateTime.UtcNow.AddDays(RefundSlaDays);
        else if (status != "REFUND_PENDING") report.RefundDeadlineAt = null;

        // Apply action
        if (status == "RESOLVED" && !string.IsNullOrWhiteSpace(report.AdminAction))
            await ApplyActionAsync(report.AdminAction, report);

        await _reportRepo.UpdateAsync(report);

        // Log
        await _reportRepo.AddLogAsync(new ViolationReportLog { Id = Guid.NewGuid(), ReportId = report.Id, AdminUserId = adminId, Status = status, AdminAction = action, AdminNote = report.AdminNote, CreatedAt = DateTime.UtcNow });

        var now = DateTime.UtcNow;
        return new ReportUpdateResult
        {
            ReportId = report.Id, Status = report.Status, AdminAction = report.AdminAction, AdminNote = report.AdminNote,
            DecisionAt = report.DecisionAt, RefundDeadlineAt = report.RefundDeadlineAt,
            RefundOverdue = report.Status == "REFUND_PENDING" && report.RefundDeadlineAt != null && report.RefundDeadlineAt < now,
            EnteredRefundPending = enteredRefundPending, ReporterUserId = report.ReporterUserId,
            TargetType = report.TargetType, TargetId = report.TargetId, Reason = report.Reason,
        };
    }

    public async Task<object> GetReportHistoryAsync(Guid reportId)
    {
        var logs = await _reportRepo.GetLogsAsync(reportId);
        return logs.Select(l => new { l.Id, l.CreatedAt, l.Status, l.AdminAction, l.AdminNote, AdminName = l.AdminUser?.FullName }).ToList();
    }

    public async Task<string?> ResolveTargetNameAsync(string? targetType, Guid? targetId)
        => await _reportRepo.ResolveTargetNameAsync(targetType, targetId);

    public async Task<Guid?> ResolveTargetOwnerAsync(string? targetType, Guid targetId)
        => await _reportRepo.ResolveTargetOwnerAsync(targetType, targetId);

    public async Task<(Guid? venueOwnerId, string? venueName)?> GetBookingVenueInfoAsync(Guid bookingId)
        => await _reportRepo.GetBookingVenueInfoAsync(bookingId);

    private async Task ApplyActionAsync(string action, ViolationReport report)
    {
        if (report.TargetId == null || report.TargetId == Guid.Empty) return;
        if (action == "REMOVE_POST" && report.TargetType == "MATCHING_POST")
            await _reportRepo.DeactivateMatchingPostAsync(report.TargetId.Value);
    }
}

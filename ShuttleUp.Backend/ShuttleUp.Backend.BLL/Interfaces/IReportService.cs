namespace ShuttleUp.BLL.Interfaces;

public interface IReportService
{
    Task<object> GetReportsPagedAsync(string? targetType, string? status, string? search, bool overdueRefund, int page, int pageSize);
    Task<object?> GetReportDetailAsync(Guid id);
    Task<ReportUpdateResult> UpdateReportAsync(Guid reportId, Guid adminId, string status, string? adminAction, string? adminNote);
    Task<object> GetReportHistoryAsync(Guid reportId);

    // Resolve display names
    Task<string?> ResolveTargetNameAsync(string? targetType, Guid? targetId);

    // Resolve owner user for notifications
    Task<Guid?> ResolveTargetOwnerAsync(string? targetType, Guid targetId);
    Task<(Guid? venueOwnerId, string? venueName)?> GetBookingVenueInfoAsync(Guid bookingId);

    // End-User operations
    Task<ShuttleUp.BLL.DTOs.Report.MyReportsPagedResultDto> GetMyReportsAsync(Guid userId, int page, int pageSize);
    Task<Guid> CreateReportAsync(Guid userId, ShuttleUp.BLL.DTOs.Report.CreateReportRequestDto dto);
    Task<ShuttleUp.BLL.DTOs.Profile.ManagerDocumentDto> UploadReportImageAsync(Guid userId, Microsoft.AspNetCore.Http.IFormFile file, Guid reportId, System.Threading.CancellationToken cancellationToken = default);
}

/// <summary>
/// Kết quả cập nhật report — Controller dùng để gửi notifications.
/// </summary>
public class ReportUpdateResult
{
    public Guid ReportId { get; set; }
    public string Status { get; set; } = "";
    public string? AdminAction { get; set; }
    public string? AdminNote { get; set; }
    public DateTime? DecisionAt { get; set; }
    public DateTime? RefundDeadlineAt { get; set; }
    public bool RefundOverdue { get; set; }
    public bool EnteredRefundPending { get; set; }

    // Data for notifications (Controller needs these)
    public Guid? ReporterUserId { get; set; }
    public string? TargetType { get; set; }
    public Guid? TargetId { get; set; }
    public string? Reason { get; set; }
}

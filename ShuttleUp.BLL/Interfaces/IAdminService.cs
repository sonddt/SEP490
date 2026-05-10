namespace ShuttleUp.BLL.Interfaces;

public interface IAdminService
{
    Task<object> GetDashboardStatsAsync();
    Task<object> GetAccountsPagedAsync(string? search, string? role, string? status, int page, int pageSize);
    Task<object?> GetAccountDetailAsync(Guid userId);
    Task UnblockAccountAsync(Guid userId, bool restoreVenues);
    Task<object> GetManagerRequestsPagedAsync(string? search, string? status, int page, int pageSize);
    Task<AdminApproveResult> ApproveManagerRequestAsync(Guid requestId, Guid adminId, string? note);
    Task<AdminRejectResult> RejectManagerRequestAsync(Guid requestId, Guid adminId, string? note);
    Task<object> GetBookingStatsAsync(string? status, string? startDate, string? endDate, string? search, int page, int pageSize);
    Task<object> GetRevenueStatsAsync(string? startDate, string? endDate);
}

public class AdminApproveResult
{
    public Guid UserId { get; set; }
    public string? Note { get; set; }
}

public class AdminRejectResult
{
    public Guid UserId { get; set; }
    public string? Note { get; set; }
}

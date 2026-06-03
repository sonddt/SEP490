using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IViolationReportRepository : IRepository<ViolationReport>
{
    Task<ViolationReport?> GetWithReporterAsync(Guid id);
    Task<ViolationReport?> GetDetailAsync(Guid id);
    Task<(int total, List<ViolationReport> items)> GetReportsPagedAsync(string? targetType, string? status, string? search, bool overdueRefund, int skip, int take);
    Task<(int total, List<ViolationReport> items)> GetMyReportsPagedAsync(Guid reporterId, int skip, int take);
    Task<bool> HasPendingReportAsync(Guid reporterId, string targetType, Guid targetId);
    Task AddLogAsync(ViolationReportLog log);
    Task<List<ViolationReportLog>> GetLogsAsync(Guid reportId);

    Task<int> CountPendingReportsAsync();
    Task<int> CountPendingComplaintsAsync();

    // Target name resolution
    Task<string?> ResolveTargetNameAsync(string? type, Guid? id);
    Task<Dictionary<(string, Guid), string?>> ResolveTargetNamesAsync(List<(string type, Guid id)> targets);

    // Apply actions
    Task DeactivateMatchingPostAsync(Guid postId);

    // Target owner resolution (for notifications)
    Task<Guid?> ResolveTargetOwnerAsync(string? targetType, Guid targetId);
    Task<(Guid? venueOwnerId, string? venueName)?> GetBookingVenueInfoAsync(Guid bookingId);
}

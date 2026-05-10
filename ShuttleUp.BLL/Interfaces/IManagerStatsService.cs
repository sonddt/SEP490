namespace ShuttleUp.BLL.Interfaces;

public interface IManagerStatsService
{
    Task<object> GetOverviewAsync(Guid managerId);
    Task<object> GetEarningsPagedAsync(Guid managerId, Guid? venueId, string? startDate, string? endDate, string? status, string? search, int page, int pageSize);
    Task<object> GetDailyChartAsync(Guid managerId, Guid? venueId, int days);
    Task<object> GetEarningsAnalyticsAsync(Guid managerId);
}

using System;
using System.Threading.Tasks;

namespace ShuttleUp.Backend.Services.Interfaces;

public enum BanScenario 
{ 
    Immediate,
    GracePeriod,
    OverrideGrace
}

public record BanCheckResult(
    BanScenario Scenario,
    int? OngoingBookingCount,
    bool IsInGracePeriod,
    DateTime? SoftBanExpiresAt
);

public interface IBanService
{
    Task<BanCheckResult> CheckBanScenarioAsync(Guid targetUserId);
    Task ExecuteHardBanAsync(Guid targetUserId, Guid adminId, string reason);
    Task ExecuteSoftBanAsync(Guid targetUserId, Guid adminId, string reason);
}

using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

/// <summary>
/// Periodically cancels HOLDING bookings whose hold window has expired,
/// releasing the soft-locked slots for other players.
/// </summary>
public sealed class ExpiredHoldCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredHoldCleanupService> _logger;

    public ExpiredHoldCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpiredHoldCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredHoldsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up expired holds");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CleanupExpiredHoldsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();

        var now = DateTime.UtcNow;

        var expired = await db.Bookings
            .Where(b => b.Status == "HOLDING" && b.HoldExpiresAt != null && b.HoldExpiresAt <= now)
            .ToListAsync(ct);

        if (expired.Count == 0) return;

        foreach (var booking in expired)
        {
            booking.Status = "CANCELLED";
            booking.HoldExpiresAt = null;
            booking.ManagerStatusNote = "Hết thời gian giữ chỗ (5 phút)";
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Cancelled {Count} expired HOLDING booking(s)", expired.Count);
    }
}

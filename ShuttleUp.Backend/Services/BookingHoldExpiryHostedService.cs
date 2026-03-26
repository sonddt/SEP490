using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

/// <summary>
/// Đánh dấu hold hết hạn (ACTIVE → EXPIRED) theo chu kỳ.
/// </summary>
public sealed class BookingHoldExpiryHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    public BookingHoldExpiryHostedService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();
                var now = DateTime.UtcNow;
                await db.BookingHolds
                    .Where(h => h.Status == "ACTIVE" && h.ExpiresAt < now)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(h => h.Status, "EXPIRED"),
                        stoppingToken);
            }
            catch
            {
                // log không bắt buộc — tránh crash host
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}

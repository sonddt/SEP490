using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

public sealed class SoftBanFinalizationService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SoftBanFinalizationService> _logger;

    public SoftBanFinalizationService(
        IServiceScopeFactory scopeFactory,
        ILogger<SoftBanFinalizationService> logger)
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
                await FinalizeSoftBansAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred executing SoftBanFinalizationService");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task FinalizeSoftBansAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();
        var bannedUserCache = scope.ServiceProvider.GetRequiredService<IBannedUserCache>();
        var notification = scope.ServiceProvider.GetRequiredService<INotificationDispatchService>();

        var now = DateTime.UtcNow;

        var expiredUsers = await db.Users
            .Where(u => u.BanType == "SOFT" && u.SoftBanExpiresAt != null && u.SoftBanExpiresAt <= now)
            .ToListAsync(ct);

        if (expiredUsers.Count == 0) return;

        foreach (var user in expiredUsers)
        {
            user.IsActive = false;
            user.BanType = "HARD";
            user.BlockedAt = now;
            user.BlockedReason = "Hết hạn giai đoạn ân hạn (tự động khóa vĩnh viễn)";
            bannedUserCache.AddBannedUser(user.Id);

            // Notify customers of this manager
            var upcomingBookings = await db.Bookings
                .Include(b => b.Venue)
                .Include(b => b.User)
                .Where(b => b.Venue != null && b.Venue.OwnerUserId == user.Id)
                .Where(b => b.Status == "PENDING" || b.Status == "CONFIRMED")
                .Where(b => b.BookingItems.Any(bi => bi.StartTime > now))
                .ToListAsync(ct);

            foreach (var booking in upcomingBookings)
            {
                if (booking.User == null || booking.Venue == null) continue;

                string emailBody = $@"
                <div style=""font-family:Arial,sans-serif;max-width:600px;margin:auto"">
                    <h2 style=""color:#e11d48"">Thông báo về lịch đặt sân</h2>
                    <p>Xin chào <strong>{booking.User.FullName}</strong>,</p>
                    <p>Sân <strong>{booking.Venue.Name}</strong> mà bạn đã đặt lịch đã <strong>tạm ngừng hợp tác với ShuttleUp</strong>.</p>
                    <p>Hồ sơ đặt sân của bạn có thể vẫn được lưu tại sân, nhưng vui lòng liên hệ trực tiếp hotline sân (<strong>{booking.Venue.ContactPhone ?? "Không có SĐT"}</strong>) để xác nhận lịch trước khi đến.</p>
                    <p>ShuttleUp xin lỗi vì sự bất tiện này.</p>
                </div>";

                await notification.NotifyUserAsync(
                    userId: booking.User.Id,
                    type: "SYSTEM",
                    title: "Thông báo về lịch đặt sân tại " + booking.Venue.Name,
                    body: $"Sân {booking.Venue.Name} đã ngừng hợp tác. Vui lòng liên hệ sân để xác nhận.",
                    sendEmail: true,
                    htmlBodyOverride: emailBody,
                    cancellationToken: ct
                );
            }
            
            _logger.LogInformation("Soft ban finalized for User {UserId}. Notified {Count} affected bookings.", user.Id, upcomingBookings.Count);
        }

        await db.SaveChangesAsync(ct);
    }
}

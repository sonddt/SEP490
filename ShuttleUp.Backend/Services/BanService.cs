using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

public class BanService : IBanService
{
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notification;
    private readonly IEmailTemplateService _templateService;
    private readonly IBannedUserCache _bannedUserCache;
    private readonly ILogger<BanService> _logger;

    public BanService(
        ShuttleUpDbContext db,
        INotificationDispatchService notification,
        IBannedUserCache bannedUserCache,
        IEmailTemplateService templateService,
        ILogger<BanService> logger)
    {
        _db = db;
        _notification = notification;
        _bannedUserCache = bannedUserCache;
        _templateService = templateService;
        _logger = logger;
    }

    public async Task<BanCheckResult> CheckBanScenarioAsync(Guid targetUserId)
    {
        var user = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == targetUserId);

        if (user == null) 
            return new BanCheckResult(BanScenario.Immediate, 0, false, null);

        if (user.BanType == "SOFT") 
        {
            return new BanCheckResult(BanScenario.OverrideGrace, 0, true, user.SoftBanExpiresAt);
        }

        bool isManager = user.Roles.Any(r => r.Name == "MANAGER");
        if (isManager)
        {
            var now = DateTime.UtcNow;
            int ongoingCount = await _db.Bookings
                .Include(b => b.Venue)
                .Where(b => b.Venue != null && b.Venue.OwnerUserId == targetUserId)
                .Where(b => b.Status == "PENDING" || b.Status == "CONFIRMED")
                .Where(b => b.BookingItems.Any(bi => bi.StartTime > now))
                .CountAsync();
                
            if (ongoingCount > 0)
            {
                return new BanCheckResult(BanScenario.GracePeriod, ongoingCount, false, null);
            }
        }

        return new BanCheckResult(BanScenario.Immediate, 0, false, null);
    }

    public async Task ExecuteHardBanAsync(Guid targetUserId, Guid adminId, string reason)
    {
        var user = await _db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == targetUserId);
        if (user == null) return;

        user.IsActive = false;
        user.BanType = "HARD";
        user.BlockedAt = DateTime.UtcNow;
        user.BlockedBy = adminId;
        user.BlockedReason = reason;

        bool isManager = user.Roles.Any(r => r.Name == "MANAGER");
        if (isManager)
        {
            var venues = await _db.Venues.Where(v => v.OwnerUserId == targetUserId).ToListAsync();
            foreach (var v in venues) { v.IsActive = false; }
        }

        _bannedUserCache.AddBannedUser(targetUserId);
        await _db.SaveChangesAsync();

        var placeholders = new Dictionary<string, string>
        {
            { "FullName", user.FullName },
            { "Reason", reason }
        };

        string emailBody = await _templateService.GetTemplateAsync("HardBanNotification", placeholders);

        await _notification.NotifyUserAsync(
            userId: targetUserId,
            type: "SYSTEM",
            title: "Tài khoản bị khóa",
            body: "Tài khoản của bạn đã bị khóa vĩnh viễn.",
            sendEmail: true,
            htmlBodyOverride: emailBody
        );

        _logger.LogInformation("Hard ban executed for User {UserId} by Admin {AdminId}", targetUserId, adminId);
    }

    public async Task ExecuteSoftBanAsync(Guid targetUserId, Guid adminId, string reason)
    {
        var user = await _db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == targetUserId);
        if (user == null) return;

        var expiresAt = DateTime.UtcNow.AddDays(3);
        user.BanType = "SOFT";
        user.SoftBanExpiresAt = expiresAt;

        var venues = await _db.Venues.Where(v => v.OwnerUserId == targetUserId).ToListAsync();
        foreach (var v in venues) { v.IsActive = false; }

        await _db.SaveChangesAsync();

        var placeholders = new Dictionary<string, string>
        {
            { "FullName", user.FullName },
            { "Reason", reason },
            { "ExpiresAt", expiresAt.ToString("dd/MM/yyyy HH:mm") + " UTC" }
        };

        string emailBody = await _templateService.GetTemplateAsync("SoftBanWarning", placeholders);

        await _notification.NotifyUserAsync(
            userId: targetUserId,
            type: "SYSTEM",
            title: "Tài khoản sắp bị khóa (Ân hạn 3 ngày)",
            body: "Các sân của bạn đã bị ẩn. Vui lòng xử lý booking trong 3 ngày.",
            sendEmail: true,
            htmlBodyOverride: emailBody
        );

        _logger.LogInformation("Soft ban executed for Manager {UserId} by Admin {AdminId}, expires at {ExpiresAt}", targetUserId, adminId, expiresAt);
    }
}

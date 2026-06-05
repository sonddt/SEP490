using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class BanService : IBanService
{
    private readonly IUserRepository _userRepo;
    private readonly IBookingRepository _bookingRepo;
    private readonly IVenueRepository _venueRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationDispatchService _notification;
    private readonly IEmailTemplateService _templateService;
    private readonly IBannedUserCache _bannedUserCache;
    private readonly ILogger<BanService> _logger;

    public BanService(
        IUserRepository userRepo,
        IBookingRepository bookingRepo,
        IVenueRepository venueRepo,
        IUnitOfWork unitOfWork,
        INotificationDispatchService notification,
        IBannedUserCache bannedUserCache,
        IEmailTemplateService templateService,
        ILogger<BanService> logger)
    {
        _userRepo = userRepo;
        _bookingRepo = bookingRepo;
        _venueRepo = venueRepo;
        _unitOfWork = unitOfWork;
        _notification = notification;
        _bannedUserCache = bannedUserCache;
        _templateService = templateService;
        _logger = logger;
    }

    public async Task<BanCheckResult> CheckBanScenarioAsync(Guid targetUserId)
    {
        var user = await _userRepo.GetWithRolesAsync(targetUserId);

        if (user == null)
            return new BanCheckResult(BanScenario.Immediate, 0, false, null);

        if (user.BanType == "SOFT")
        {
            return new BanCheckResult(BanScenario.OverrideGrace, 0, true, user.SoftBanExpiresAt);
        }

        bool isManager = user.Roles.Any(r => r.Name == "MANAGER");
        if (isManager)
        {
            int ongoingCount = await _bookingRepo.CountOngoingByOwnerAsync(targetUserId);

            if (ongoingCount > 0)
            {
                return new BanCheckResult(BanScenario.GracePeriod, ongoingCount, false, null);
            }
        }

        return new BanCheckResult(BanScenario.Immediate, 0, false, null);
    }

    public async Task ExecuteHardBanAsync(Guid targetUserId, Guid adminId, string reason)
    {
        var user = await _userRepo.GetWithRolesAsync(targetUserId);
        if (user == null) return;

        user.IsActive = false;
        user.BanType = "HARD";
        user.BlockedAt = DateTime.UtcNow;
        user.BlockedBy = adminId;
        user.BlockedReason = reason;

        bool isManager = user.Roles.Any(r => r.Name == "MANAGER");
        if (isManager)
        {
            var venues = (await _venueRepo.GetByOwnerAsync(targetUserId)).ToList();
            foreach (var v in venues) { v.IsActive = false; }
        }

        _bannedUserCache.AddBannedUser(targetUserId);
        await _unitOfWork.SaveChangesAsync();

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
        var user = await _userRepo.GetWithRolesAsync(targetUserId);
        if (user == null) return;

        var expiresAt = DateTime.UtcNow.AddDays(3);
        user.BanType = "SOFT";
        user.SoftBanExpiresAt = expiresAt;

        var venues = (await _venueRepo.GetByOwnerAsync(targetUserId)).ToList();
        foreach (var v in venues) { v.IsActive = false; }

        await _unitOfWork.SaveChangesAsync();

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

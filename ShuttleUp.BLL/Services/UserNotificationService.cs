using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using ShuttleUp.BLL.DTOs.Notification;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class UserNotificationService : IUserNotificationService
{
    private readonly IUserNotificationRepository _notificationRepo;

    public UserNotificationService(IUserNotificationRepository notificationRepo)
    {
        _notificationRepo = notificationRepo;
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _notificationRepo.GetUnreadCountAsync(userId);
    }

    public async Task<NotificationsPagedResultDto> GetNotificationsPagedAsync(Guid userId, int take, string? beforeIso)
    {
        take = Math.Clamp(take, 1, 100);

        DateTime? beforeUtc = null;
        if (!string.IsNullOrWhiteSpace(beforeIso)
            && DateTime.TryParse(beforeIso, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
        {
            beforeUtc = parsed.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
                : parsed.ToUniversalTime();
        }

        // Lấy thêm 1 bản ghi để check hasMore
        var rows = await _notificationRepo.GetNotificationsPagedAsync(userId, take + 1, beforeUtc);

        var hasMore = rows.Count > take;
        var page = hasMore ? rows.Take(take).ToList() : rows;

        DateTime? nextBefore = page.Count > 0 ? page[^1].CreatedAt : null;

        var itemsDto = page.Select(n => new NotificationItemDto
        {
            Id = n.Id,
            Type = n.Type,
            Title = n.Title,
            Body = n.Body,
            MetadataJson = n.MetadataJson,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt
        }).ToList();

        return new NotificationsPagedResultDto
        {
            Items = itemsDto,
            HasMore = hasMore,
            NextBefore = nextBefore.HasValue
                ? nextBefore.Value.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture)
                : null
        };
    }

    public async Task<bool> MarkReadAsync(Guid id, Guid userId)
    {
        var n = await _notificationRepo.GetActiveNotificationAsync(id, userId);
        if (n == null) return false;

        n.IsRead = true;
        await _notificationRepo.SaveChangesAsync();
        return true;
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        await _notificationRepo.MarkAllReadAsync(userId);
    }

    public async Task<bool> SoftDeleteAsync(Guid id, Guid userId)
    {
        var n = await _notificationRepo.GetActiveNotificationAsync(id, userId);
        if (n == null) return false;

        n.IsDeleted = true;
        await _notificationRepo.SaveChangesAsync();
        return true;
    }
}

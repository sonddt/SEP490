using System;
using System.Threading.Tasks;
using ShuttleUp.BLL.DTOs.Notification;

namespace ShuttleUp.BLL.Interfaces;

public interface IUserNotificationService
{
    Task<int> GetUnreadCountAsync(Guid userId);
    Task<NotificationsPagedResultDto> GetNotificationsPagedAsync(Guid userId, int take, string? beforeIso);
    Task<bool> MarkReadAsync(Guid id, Guid userId);
    Task MarkAllReadAsync(Guid userId);
    Task<bool> SoftDeleteAsync(Guid id, Guid userId);
}

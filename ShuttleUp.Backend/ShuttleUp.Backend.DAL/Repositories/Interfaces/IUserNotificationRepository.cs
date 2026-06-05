using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IUserNotificationRepository : IRepository<UserNotification>
{
    Task<int> GetUnreadCountAsync(Guid userId);
    Task<List<UserNotification>> GetNotificationsPagedAsync(Guid userId, int take, DateTime? beforeUtc);
    Task<UserNotification?> GetActiveNotificationAsync(Guid id, Guid userId);
    Task MarkAllReadAsync(Guid userId);
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class UserNotificationRepository : Repository<UserNotification>, IUserNotificationRepository
{
    public UserNotificationRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _dbSet.AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead && !n.IsDeleted);
    }

    public async Task<List<UserNotification>> GetNotificationsPagedAsync(Guid userId, int take, DateTime? beforeUtc)
    {
        var q = _dbSet.AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsDeleted);

        if (beforeUtc.HasValue)
            q = q.Where(n => n.CreatedAt < beforeUtc.Value);

        return await q
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.Id)
            .Take(take)
            .ToListAsync();
    }

    public async Task<UserNotification?> GetActiveNotificationAsync(Guid id, Guid userId)
    {
        return await _dbSet.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId && !x.IsDeleted);
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        await _dbSet
            .Where(x => x.UserId == userId && !x.IsRead && !x.IsDeleted)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsRead, true));
    }
}

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Services;

public class BannedUserCache : IBannedUserCache
{
    private readonly ConcurrentDictionary<Guid, byte> _bannedUsers = new();

    public void AddBannedUser(Guid userId)
    {
        _bannedUsers.TryAdd(userId, 0);
    }

    public bool IsBanned(Guid userId)
    {
        return _bannedUsers.ContainsKey(userId);
    }

    public void Remove(Guid userId)
    {
        _bannedUsers.TryRemove(userId, out _);
    }

    public void Populate(IEnumerable<Guid> bannedUserIds)
    {
        _bannedUsers.Clear();
        foreach (var id in bannedUserIds)
        {
            _bannedUsers.TryAdd(id, 0);
        }
    }
}

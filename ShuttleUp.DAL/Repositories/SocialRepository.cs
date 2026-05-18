using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class SocialRepository : ISocialRepository
{
    private readonly ShuttleUpDbContext _db;

    public SocialRepository(ShuttleUpDbContext db)
    {
        _db = db;
    }

    public async Task<UserPrivacySettings?> GetPrivacyAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.UserPrivacySettings.FirstOrDefaultAsync(p => p.UserId == userId, ct);
    }

    public Task AddPrivacyAsync(UserPrivacySettings privacy, CancellationToken ct = default)
    {
        _db.UserPrivacySettings.Add(privacy);
        return Task.CompletedTask;
    }

    public Task UpdatePrivacyAsync(UserPrivacySettings privacy, CancellationToken ct = default)
    {
        // Entity is usually tracked, so Update is often implicit or we can explicitly call Update
        _db.UserPrivacySettings.Update(privacy);
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<FriendRequest>> GetPendingRequestsBetweenAsync(Guid userA, Guid userB, CancellationToken ct = default)
    {
        return await _db.FriendRequests
            .Where(r => r.Status == "PENDING" &&
                        ((r.FromUserId == userA && r.ToUserId == userB) || (r.FromUserId == userB && r.ToUserId == userA)))
            .ToListAsync(ct);
    }

    public async Task<FriendRequest?> GetPendingRequestAsync(Guid fromUserId, Guid toUserId, CancellationToken ct = default)
    {
        return await _db.FriendRequests.FirstOrDefaultAsync(r =>
            r.Status == "PENDING" && r.FromUserId == fromUserId && r.ToUserId == toUserId, ct);
    }

    public async Task<FriendRequest?> GetFriendRequestByIdAsync(Guid requestId, CancellationToken ct = default)
    {
        return await _db.FriendRequests.FirstOrDefaultAsync(x => x.Id == requestId, ct);
    }

    public Task AddRequestAsync(FriendRequest request, CancellationToken ct = default)
    {
        _db.FriendRequests.Add(request);
        return Task.CompletedTask;
    }

    public Task UpdateRequestAsync(FriendRequest request, CancellationToken ct = default)
    {
        _db.FriendRequests.Update(request);
        return Task.CompletedTask;
    }

    public Task UpdateRequestsAsync(IEnumerable<FriendRequest> requests, CancellationToken ct = default)
    {
        _db.FriendRequests.UpdateRange(requests);
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<FriendRequest>> GetIncomingRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.FriendRequests.AsNoTracking()
            .Include(r => r.FromUser).ThenInclude(u => u!.AvatarFile)
            .Where(r => r.ToUserId == userId && r.Status == "PENDING")
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<FriendRequest>> GetSentRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.FriendRequests.AsNoTracking()
            .Include(r => r.ToUser).ThenInclude(u => u!.AvatarFile)
            .Where(r => r.FromUserId == userId && r.Status == "PENDING")
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<bool> FriendshipExistsAsync(Guid userLowId, Guid userHighId, CancellationToken ct = default)
    {
        return await _db.Friendships.AsNoTracking().AnyAsync(f => f.UserLowId == userLowId && f.UserHighId == userHighId, ct);
    }

    public async Task<Friendship?> GetFriendshipAsync(Guid userLowId, Guid userHighId, CancellationToken ct = default)
    {
        return await _db.Friendships.FirstOrDefaultAsync(x => x.UserLowId == userLowId && x.UserHighId == userHighId, ct);
    }

    public Task AddFriendshipAsync(Friendship friendship, CancellationToken ct = default)
    {
        _db.Friendships.Add(friendship);
        return Task.CompletedTask;
    }

    public Task RemoveFriendshipAsync(Friendship friendship, CancellationToken ct = default)
    {
        _db.Friendships.Remove(friendship);
        return Task.CompletedTask;
    }

    public async Task<IEnumerable<Guid>> GetFriendIdsAsync(Guid userId, CancellationToken ct = default)
    {
        var lowRows = await _db.Friendships.AsNoTracking()
            .Where(f => f.UserLowId == userId || f.UserHighId == userId)
            .ToListAsync(ct);
        return lowRows.Select(f => f.UserLowId == userId ? f.UserHighId : f.UserLowId).ToList();
    }

    public async Task<bool> IsEitherBlockedAsync(Guid userA, Guid userB, CancellationToken ct = default)
    {
        return await _db.UserBlocks.AsNoTracking().AnyAsync(x =>
            (x.BlockerId == userA && x.BlockedId == userB) || (x.BlockerId == userB && x.BlockedId == userA), ct);
    }

    public async Task<IEnumerable<Guid>> GetBlockedUserIdsAsync(Guid userId, CancellationToken ct = default)
    {
        var blocks = await _db.UserBlocks.AsNoTracking()
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .ToListAsync(ct);
        return blocks.Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId).ToList();
    }

    public async Task<UserBlock?> GetBlockAsync(Guid blockerId, Guid blockedId, CancellationToken ct = default)
    {
        return await _db.UserBlocks.FirstOrDefaultAsync(x => x.BlockerId == blockerId && x.BlockedId == blockedId, ct);
    }
    
    public async Task<bool> IsBlockedByMeAsync(Guid me, Guid other, CancellationToken ct = default)
    {
        return await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == me && b.BlockedId == other, ct);
    }

    public async Task<bool> IsBlockedByThemAsync(Guid me, Guid other, CancellationToken ct = default)
    {
        return await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == other && b.BlockedId == me, ct);
    }

    public Task AddBlockAsync(UserBlock block, CancellationToken ct = default)
    {
        _db.UserBlocks.Add(block);
        return Task.CompletedTask;
    }

    public Task RemoveBlockAsync(UserBlock block, CancellationToken ct = default)
    {
        _db.UserBlocks.Remove(block);
        return Task.CompletedTask;
    }

    public async Task<User?> SearchExactEmailAsync(string email, CancellationToken ct = default)
    {
        return await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .Include(u => u.UserPrivacySettings)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower() && u.IsActive != false, ct);
    }

    public async Task<User?> SearchExactPhoneAsync(string digits, CancellationToken ct = default)
    {
        var users = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .Include(u => u.UserPrivacySettings)
            .Where(u => u.PhoneNumber != null && u.IsActive != false)
            .ToListAsync(ct);
            
        // Filtering in-memory since NormalizePhone is custom C# code
        return users.FirstOrDefault(u => new string(u.PhoneNumber!.Where(char.IsDigit).ToArray()) == digits);
    }

    public async Task<IEnumerable<User>> SearchByNameAsync(string term, IEnumerable<Guid> blockedIds, Guid currentUserId, int take, CancellationToken ct = default)
    {
        var blockedSet = blockedIds.ToHashSet();
        blockedSet.Add(currentUserId);

        var list = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .Where(u => u.IsActive != false && u.Id != currentUserId)
            .Where(u => EF.Functions.Like(u.FullName, $"%{term}%"))
            .OrderBy(u => u.FullName)
            .Take(take + 5)
            .ToListAsync(ct);

        return list.Where(x => !blockedSet.Contains(x.Id)).Take(take).ToList();
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}

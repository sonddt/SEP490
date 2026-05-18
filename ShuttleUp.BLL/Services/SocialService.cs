using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Social;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class SocialService : ISocialService
{
    private readonly ISocialRepository _socialRepo;
    private readonly INotificationDispatchService _notify;
    private readonly IUserRepository _userRepo;
    private readonly ShuttleUpDbContext _dbContext;

    public SocialService(
        ISocialRepository socialRepo, 
        INotificationDispatchService notify, 
        IUserRepository userRepo,
        ShuttleUpDbContext dbContext) // Only injected for transaction management
    {
        _socialRepo = socialRepo;
        _notify = notify;
        _userRepo = userRepo;
        _dbContext = dbContext;
    }

    private static (Guid Low, Guid High) OrderedPair(Guid a, Guid b) =>
        string.Compare(a.ToString("D"), b.ToString("D"), StringComparison.Ordinal) < 0 ? (a, b) : (b, a);

    public async Task<PrivacyDto> GetPrivacyAsync(Guid userId, CancellationToken ct = default)
    {
        var row = await _socialRepo.GetPrivacyAsync(userId, ct);
        if (row != null) 
            return new PrivacyDto { AllowFindByEmail = row.AllowFindByEmail, AllowFindByPhone = row.AllowFindByPhone };

        row = new UserPrivacySettings
        {
            UserId = userId,
            AllowFindByEmail = true,
            AllowFindByPhone = true
        };
        await _socialRepo.AddPrivacyAsync(row, ct);
        await _socialRepo.SaveChangesAsync(ct);
        
        return new PrivacyDto { AllowFindByEmail = true, AllowFindByPhone = true };
    }

    public async Task<PrivacyDto> UpdatePrivacyAsync(Guid userId, PrivacyDto dto, CancellationToken ct = default)
    {
        var row = await _socialRepo.GetPrivacyAsync(userId, ct);
        if (row == null)
        {
            row = new UserPrivacySettings { UserId = userId, AllowFindByEmail = dto.AllowFindByEmail, AllowFindByPhone = dto.AllowFindByPhone };
            await _socialRepo.AddPrivacyAsync(row, ct);
        }
        else
        {
            row.AllowFindByEmail = dto.AllowFindByEmail;
            row.AllowFindByPhone = dto.AllowFindByPhone;
            await _socialRepo.UpdatePrivacyAsync(row, ct);
        }
        
        await _socialRepo.SaveChangesAsync(ct);
        return dto;
    }

    public async Task<IEnumerable<UserSearchDto>> SearchExactAsync(Guid currentUserId, string query, CancellationToken ct = default)
    {
        var q = (query ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(q)) return Array.Empty<UserSearchDto>();

        User? target = null;
        if (q.Contains('@', StringComparison.Ordinal))
        {
            target = await _socialRepo.SearchExactEmailAsync(q, ct);
            if (target != null && target.UserPrivacySettings != null && !target.UserPrivacySettings.AllowFindByEmail)
                return Array.Empty<UserSearchDto>();
        }
        else
        {
            var digits = new string(q.Where(char.IsDigit).ToArray());
            if (digits.Length == 0) return Array.Empty<UserSearchDto>();
            
            target = await _socialRepo.SearchExactPhoneAsync(digits, ct);
            if (target != null && target.UserPrivacySettings != null && !target.UserPrivacySettings.AllowFindByPhone)
                return Array.Empty<UserSearchDto>();
        }

        if (target == null || target.Id == currentUserId) return Array.Empty<UserSearchDto>();
        if (await _socialRepo.IsEitherBlockedAsync(currentUserId, target.Id, ct)) return Array.Empty<UserSearchDto>();

        return new[] { new UserSearchDto { Id = target.Id, FullName = target.FullName, AvatarUrl = target.AvatarFile?.FileUrl } };
    }

    public async Task<IEnumerable<UserSearchDto>> SearchByNameAsync(Guid currentUserId, string query, int take = 15, CancellationToken ct = default)
    {
        var term = (query ?? string.Empty).Trim();
        if (term.Length < 1) return Array.Empty<UserSearchDto>();
        take = Math.Clamp(take, 1, 30);

        var blockedIds = await _socialRepo.GetBlockedUserIdsAsync(currentUserId, ct);
        var users = await _socialRepo.SearchByNameAsync(term, blockedIds, currentUserId, take, ct);

        return users.Select(u => new UserSearchDto
        {
            Id = u.Id,
            FullName = u.FullName,
            AvatarUrl = u.AvatarFile?.FileUrl
        });
    }

    public async Task<AcceptRequestResponseDto> SendFriendRequestAsync(Guid currentUserId, Guid toUserId, CancellationToken ct = default)
    {
        if (toUserId == currentUserId)
            throw new InvalidOperationException("Bạn không thể gửi lời mời cho chính mình.");
            
        var other = await _userRepo.GetByIdAsync(toUserId);
        if (other == null || other.IsActive == false)
            throw new KeyNotFoundException("Không tìm thấy người dùng này.");
            
        if (await _socialRepo.IsEitherBlockedAsync(currentUserId, toUserId, ct))
            throw new InvalidOperationException("Không thể gửi lời mời trong trạng thái hiện tại.");

        var (low, high) = OrderedPair(currentUserId, toUserId);
        if (await _socialRepo.FriendshipExistsAsync(low, high, ct))
            throw new InvalidOperationException("Hai bạn đã là bạn bè rồi.");

        var pendingOut = await _socialRepo.GetPendingRequestAsync(currentUserId, toUserId, ct);
        if (pendingOut != null)
            throw new InvalidOperationException("Bạn đã gửi lời mời trước đó rồi.");

        var incoming = await _socialRepo.GetPendingRequestAsync(toUserId, currentUserId, ct);
        if (incoming != null)
        {
            if (await _socialRepo.IsEitherBlockedAsync(currentUserId, toUserId, ct))
                throw new InvalidOperationException("Không thể chấp nhận lời mời trong trạng thái hiện tại.");
                
            await AcceptPendingFriendRequestAndNotifyAsync(currentUserId, incoming, ct);
            return new AcceptRequestResponseDto
            {
                Id = incoming.Id,
                MutualAutoAccept = true,
                Message = "Hai bạn đã là bạn bè — lời mời của đối phương đã được chấp nhận."
            };
        }

        var req = new FriendRequest
        {
            Id = Guid.NewGuid(),
            FromUserId = currentUserId,
            ToUserId = toUserId,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        await _socialRepo.AddRequestAsync(req, ct);
        await _socialRepo.SaveChangesAsync(ct);

        // Check for simultaneous reverse request
        var reversePending = (await _socialRepo.GetPendingRequestsBetweenAsync(currentUserId, toUserId, ct))
                             .FirstOrDefault(r => r.FromUserId == toUserId && r.ToUserId == currentUserId && r.Id != req.Id);
                             
        if (reversePending != null)
        {
            if (await _socialRepo.IsEitherBlockedAsync(currentUserId, toUserId, ct))
            {
                req.Status = "CANCELLED";
                req.RespondedAt = DateTime.UtcNow;
                await _socialRepo.UpdateRequestAsync(req, ct);
                await _socialRepo.SaveChangesAsync(ct);
                throw new InvalidOperationException("Không thể kết bạn trong trạng thái hiện tại.");
            }

            await MergeSimultaneousOppositePendingAsync(currentUserId, toUserId, req, reversePending, ct);
            return new AcceptRequestResponseDto
            {
                Id = reversePending.Id,
                SimultaneousMutual = true,
                Message = "Hai bạn đã là bạn bè — cùng gửi lời mời lúc đó nên hệ thống đã ghép luôn."
            };
        }

        if (await _socialRepo.FriendshipExistsAsync(low, high, ct))
        {
            req.Status = "CANCELLED";
            req.RespondedAt = DateTime.UtcNow;
            await _socialRepo.UpdateRequestAsync(req, ct);
            await _socialRepo.SaveChangesAsync(ct);
            return new AcceptRequestResponseDto
            {
                Id = req.Id,
                SimultaneousMutual = true,
                Message = "Hai bạn đã là bạn bè — đối phương vừa chấp nhận lúc này."
            };
        }

        var fromName = (await _userRepo.GetByIdAsync(currentUserId))?.FullName;
        await _notify.NotifyUserAsync(
            toUserId,
            NotificationTypes.FriendRequest,
            "Lời mời kết bạn",
            $"{fromName} muốn kết bạn với bạn.",
            new { fromUserId = currentUserId, requestId = req.Id, deepLink = $"/user/profile/{currentUserId}" },
            false, null, null, ct);

        return new AcceptRequestResponseDto { Id = req.Id, Message = "Đã gửi lời mời kết bạn." };
    }

    public async Task CancelSentRequestAsync(Guid currentUserId, Guid toUserId, CancellationToken ct = default)
    {
        var r = await _socialRepo.GetPendingRequestAsync(currentUserId, toUserId, ct);
        if (r == null) throw new KeyNotFoundException("Không có lời mời đang chờ để thu hồi.");
        
        r.Status = "CANCELLED";
        r.RespondedAt = DateTime.UtcNow;
        await _socialRepo.UpdateRequestAsync(r, ct);
        await _socialRepo.SaveChangesAsync(ct);
    }

    public async Task AcceptRequestAsync(Guid currentUserId, Guid requestId, CancellationToken ct = default)
    {
        var r = await _socialRepo.GetFriendRequestByIdAsync(requestId, ct);
        if (r == null || r.ToUserId != currentUserId || r.Status != "PENDING")
            throw new KeyNotFoundException("Không tìm thấy lời mời hợp lệ.");
            
        if (await _socialRepo.IsEitherBlockedAsync(currentUserId, r.FromUserId, ct))
            throw new InvalidOperationException("Không thể chấp nhận lời mời này.");

        await AcceptPendingFriendRequestAndNotifyAsync(currentUserId, r, ct);
    }

    public async Task DeclineRequestAsync(Guid currentUserId, Guid requestId, CancellationToken ct = default)
    {
        var r = await _socialRepo.GetFriendRequestByIdAsync(requestId, ct);
        if (r == null || r.ToUserId != currentUserId || r.Status != "PENDING")
            throw new KeyNotFoundException("Không tìm thấy lời mời hợp lệ.");
            
        r.Status = "DECLINED";
        r.RespondedAt = DateTime.UtcNow;
        await _socialRepo.UpdateRequestAsync(r, ct);
        await _socialRepo.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<FriendRequestDto>> GetIncomingRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        var list = await _socialRepo.GetIncomingRequestsAsync(userId, ct);
        return list.Select(r => new FriendRequestDto
        {
            Id = r.Id,
            FromUserId = r.FromUserId,
            FullName = r.FromUser?.FullName,
            AvatarUrl = r.FromUser?.AvatarFile?.FileUrl,
            CreatedAt = r.CreatedAt
        });
    }

    public async Task<IEnumerable<FriendRequestDto>> GetSentRequestsAsync(Guid userId, CancellationToken ct = default)
    {
        var list = await _socialRepo.GetSentRequestsAsync(userId, ct);
        return list.Select(r => new FriendRequestDto
        {
            Id = r.Id,
            ToUserId = r.ToUserId,
            FullName = r.ToUser?.FullName,
            AvatarUrl = r.ToUser?.AvatarFile?.FileUrl,
            CreatedAt = r.CreatedAt
        });
    }

    public async Task<IEnumerable<FriendDto>> GetFriendsAsync(Guid userId, CancellationToken ct = default)
    {
        var friendIds = await _socialRepo.GetFriendIdsAsync(userId, ct);
        if (!friendIds.Any()) return Array.Empty<FriendDto>();

        var users = await _userRepo.GetByIdsAsync(friendIds);
        return users.Select(u => new FriendDto
        {
            Id = u.Id,
            FullName = u.FullName,
            AvatarUrl = u.AvatarFile?.FileUrl
        }).OrderBy(u => u.FullName);
    }

    public async Task UnfriendAsync(Guid currentUserId, Guid friendUserId, CancellationToken ct = default)
    {
        if (friendUserId == currentUserId) throw new InvalidOperationException("Hành động không hợp lệ.");
        
        var (low, high) = OrderedPair(currentUserId, friendUserId);
        var f = await _socialRepo.GetFriendshipAsync(low, high, ct);
        if (f == null) throw new KeyNotFoundException("Hai bạn chưa là bạn bè.");
        
        await _socialRepo.RemoveFriendshipAsync(f, ct);
        await _socialRepo.SaveChangesAsync(ct);
    }

    public async Task BlockUserAsync(Guid currentUserId, Guid blockedUserId, CancellationToken ct = default)
    {
        if (blockedUserId == currentUserId) throw new InvalidOperationException("Thao tác không áp dụng được.");
        
        var other = await _userRepo.GetByIdAsync(blockedUserId);
        if (other == null) throw new KeyNotFoundException("Không tìm thấy người dùng.");
        
        var block = await _socialRepo.GetBlockAsync(currentUserId, blockedUserId, ct);
        if (block != null) throw new InvalidOperationException("Bạn đã chặn người này trước đó.");

        // Cancel pending requests
        var pending = await _socialRepo.GetPendingRequestsBetweenAsync(currentUserId, blockedUserId, ct);
        var now = DateTime.UtcNow;
        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.RespondedAt = now;
        }
        if (pending.Any()) await _socialRepo.UpdateRequestsAsync(pending, ct);

        // Remove friendship
        var (low, high) = OrderedPair(currentUserId, blockedUserId);
        var friendship = await _socialRepo.GetFriendshipAsync(low, high, ct);
        if (friendship != null) await _socialRepo.RemoveFriendshipAsync(friendship, ct);

        await _socialRepo.AddBlockAsync(new UserBlock { BlockerId = currentUserId, BlockedId = blockedUserId, CreatedAt = DateTime.UtcNow }, ct);
        await _socialRepo.SaveChangesAsync(ct);
    }

    public async Task UnblockUserAsync(Guid currentUserId, Guid blockedUserId, CancellationToken ct = default)
    {
        var b = await _socialRepo.GetBlockAsync(currentUserId, blockedUserId, ct);
        if (b == null) throw new KeyNotFoundException("Bạn chưa chặn người này.");
        
        await _socialRepo.RemoveBlockAsync(b, ct);
        await _socialRepo.SaveChangesAsync(ct);
    }

    public async Task<RelationshipStateDto> GetRelationshipAsync(Guid currentUserId, Guid otherUserId, CancellationToken ct = default)
    {
        if (otherUserId == currentUserId) return new RelationshipStateDto { State = "SELF" };
        
        var other = await _userRepo.GetByIdAsync(otherUserId);
        if (other == null || other.IsActive == false) throw new KeyNotFoundException("Không tìm thấy người dùng.");

        if (await _socialRepo.IsBlockedByMeAsync(currentUserId, otherUserId, ct)) return new RelationshipStateDto { State = "BLOCKED_BY_ME" };
        if (await _socialRepo.IsBlockedByThemAsync(currentUserId, otherUserId, ct)) return new RelationshipStateDto { State = "BLOCKED_BY_THEM" };

        var (low, high) = OrderedPair(currentUserId, otherUserId);
        if (await _socialRepo.FriendshipExistsAsync(low, high, ct)) return new RelationshipStateDto { State = "FRIENDS" };
        
        if (await _socialRepo.GetPendingRequestAsync(currentUserId, otherUserId, ct) != null) return new RelationshipStateDto { State = "PENDING_OUT" };
        
        var incomingReq = await _socialRepo.GetPendingRequestAsync(otherUserId, currentUserId, ct);
        if (incomingReq != null) return new RelationshipStateDto { State = "PENDING_IN", RequestId = incomingReq.Id };

        return new RelationshipStateDto { State = "NONE" };
    }

    // ── Internal Transaction Helpers ──
    private async Task AcceptPendingFriendRequestAndNotifyAsync(Guid accepterUserId, FriendRequest r, CancellationToken ct)
    {
        var (low, high) = OrderedPair(r.FromUserId, r.ToUserId);
        await using var tx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            r.Status = "ACCEPTED";
            r.RespondedAt = DateTime.UtcNow;
            await _socialRepo.UpdateRequestAsync(r, ct);

            if (!await _socialRepo.FriendshipExistsAsync(low, high, ct))
            {
                await _socialRepo.AddFriendshipAsync(new Friendship
                {
                    Id = Guid.NewGuid(),
                    UserLowId = low,
                    UserHighId = high,
                    CreatedAt = DateTime.UtcNow
                }, ct);
            }

            await _socialRepo.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        var accepterName = (await _userRepo.GetByIdAsync(accepterUserId))?.FullName;
        await _notify.NotifyUserAsync(
            r.FromUserId,
            NotificationTypes.FriendAccepted,
            "Kết bạn thành công",
            $"{accepterName} đã chấp nhận lời mời kết bạn.",
            new { friendUserId = accepterUserId, deepLink = $"/user/profile/{accepterUserId}" },
            false, null, null, ct);
    }

    private async Task MergeSimultaneousOppositePendingAsync(Guid me, Guid toId, FriendRequest myOutbound, FriendRequest theirInboundToMe, CancellationToken ct)
    {
        var (low, high) = OrderedPair(me, toId);
        await using var tx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            theirInboundToMe.Status = "ACCEPTED";
            theirInboundToMe.RespondedAt = DateTime.UtcNow;
            await _socialRepo.UpdateRequestAsync(theirInboundToMe, ct);

            myOutbound.Status = "CANCELLED";
            myOutbound.RespondedAt = DateTime.UtcNow;
            await _socialRepo.UpdateRequestAsync(myOutbound, ct);

            if (!await _socialRepo.FriendshipExistsAsync(low, high, ct))
            {
                await _socialRepo.AddFriendshipAsync(new Friendship
                {
                    Id = Guid.NewGuid(),
                    UserLowId = low,
                    UserHighId = high,
                    CreatedAt = DateTime.UtcNow
                }, ct);
            }

            await _socialRepo.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        var accepterName = (await _userRepo.GetByIdAsync(me))?.FullName;
        await _notify.NotifyUserAsync(
            theirInboundToMe.FromUserId,
            NotificationTypes.FriendAccepted,
            "Kết bạn thành công",
            $"{accepterName} đã chấp nhận lời mời kết bạn.",
            new { friendUserId = me, deepLink = $"/user/profile/{me}" },
            false, null, null, ct);
    }
}

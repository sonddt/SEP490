using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/social")]
[Authorize]
public class SocialController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public SocialController(ShuttleUpDbContext db, INotificationDispatchService notify)
    {
        _db = db;
        _notify = notify;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    private static string NormalizePhone(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        return new string(s.Where(char.IsDigit).ToArray());
    }

    private static (Guid Low, Guid High) OrderedPair(Guid a, Guid b) =>
        string.Compare(a.ToString("D"), b.ToString("D"), StringComparison.Ordinal) < 0 ? (a, b) : (b, a);

    private Task<bool> IsEitherBlockedAsync(Guid a, Guid b, CancellationToken ct = default) =>
        _db.UserBlocks.AsNoTracking().AnyAsync(x =>
            (x.BlockerId == a && x.BlockedId == b) || (x.BlockerId == b && x.BlockedId == a), ct);

    private async Task<UserPrivacySettings> GetOrCreatePrivacyAsync(Guid userId, CancellationToken ct = default)
    {
        var row = await _db.UserPrivacySettings.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (row != null) return row;
        row = new UserPrivacySettings
        {
            UserId = userId,
            AllowFindByEmail = true,
            AllowFindByPhone = true
        };
        _db.UserPrivacySettings.Add(row);
        await _db.SaveChangesAsync(ct);
        return row;
    }

    private async Task CancelPendingBetweenAsync(Guid a, Guid b, CancellationToken ct = default)
    {
        var pending = await _db.FriendRequests
            .Where(r => r.Status == "PENDING" &&
                        ((r.FromUserId == a && r.ToUserId == b) || (r.FromUserId == b && r.ToUserId == a)))
            .ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.RespondedAt = now;
        }
        if (pending.Count > 0)
            await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Chấp nhận lời mời PENDING (accepterUserId phải là người nhận — ToUserId).
    /// Gửi thông báo tới người gửi lời mời.
    /// </summary>
    private async Task AcceptPendingFriendRequestAndNotifyAsync(
        Guid accepterUserId,
        FriendRequest r,
        CancellationToken ct = default)
    {
        var (low, high) = OrderedPair(r.FromUserId, r.ToUserId);
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            r.Status = "ACCEPTED";
            r.RespondedAt = DateTime.UtcNow;
            if (!await _db.Friendships.AnyAsync(f => f.UserLowId == low && f.UserHighId == high, ct))
            {
                _db.Friendships.Add(new Friendship
                {
                    Id = Guid.NewGuid(),
                    UserLowId = low,
                    UserHighId = high,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        var accepterName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == accepterUserId)
            .Select(u => u.FullName)
            .FirstAsync(ct);
        await _notify.NotifyUserAsync(
            r.FromUserId,
            NotificationTypes.FriendAccepted,
            "Kết bạn thành công",
            $"{accepterName} đã chấp nhận lời mời kết bạn.",
            new { friendUserId = accepterUserId, deepLink = $"/user/profile/{accepterUserId}" },
            false,
            null,
            ct);
    }

    /// <summary>
    /// Hai lời mời PENDING cùng lúc hai chiều (A→B và B→A): gộp thành bạn bè, chấp nhận bản gửi tới <paramref name="me"/>, huỷ bản gửi đi của <paramref name="me"/>.
    /// </summary>
    private async Task MergeSimultaneousOppositePendingAsync(
        Guid me,
        Guid toId,
        FriendRequest myOutbound,
        FriendRequest theirInboundToMe,
        CancellationToken ct = default)
    {
        var (low, high) = OrderedPair(me, toId);
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            theirInboundToMe.Status = "ACCEPTED";
            theirInboundToMe.RespondedAt = DateTime.UtcNow;
            myOutbound.Status = "CANCELLED";
            myOutbound.RespondedAt = DateTime.UtcNow;
            if (!await _db.Friendships.AnyAsync(f => f.UserLowId == low && f.UserHighId == high, ct))
            {
                _db.Friendships.Add(new Friendship
                {
                    Id = Guid.NewGuid(),
                    UserLowId = low,
                    UserHighId = high,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        var accepterName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == me)
            .Select(u => u.FullName)
            .FirstAsync(ct);
        await _notify.NotifyUserAsync(
            theirInboundToMe.FromUserId,
            NotificationTypes.FriendAccepted,
            "Kết bạn thành công",
            $"{accepterName} đã chấp nhận lời mời kết bạn.",
            new { friendUserId = me, deepLink = $"/user/profile/{me}" },
            false,
            null,
            ct);
    }

    /// <summary>Cài đặt cho phép tìm theo email / SĐT.</summary>
    [HttpGet("privacy")]
    public async Task<IActionResult> GetPrivacy()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var p = await GetOrCreatePrivacyAsync(userId);
        return Ok(new { allowFindByEmail = p.AllowFindByEmail, allowFindByPhone = p.AllowFindByPhone });
    }

    public class PrivacyDto
    {
        public bool AllowFindByEmail { get; set; }
        public bool AllowFindByPhone { get; set; }
    }

    [HttpPut("privacy")]
    public async Task<IActionResult> PutPrivacy([FromBody] PrivacyDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var p = await GetOrCreatePrivacyAsync(userId);
        p.AllowFindByEmail = dto.AllowFindByEmail;
        p.AllowFindByPhone = dto.AllowFindByPhone;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã lưu cài đặt riêng tư.", allowFindByEmail = p.AllowFindByEmail, allowFindByPhone = p.AllowFindByPhone });
    }

    /// <summary>Tìm chính xác email hoặc SĐT (100% khớp).</summary>
    [HttpGet("users/search/exact")]
    public async Task<IActionResult> SearchExact([FromQuery] string? query)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var q = (query ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(q))
            return Ok(Array.Empty<object>());

        User? target = null;
        if (q.Contains('@', StringComparison.Ordinal))
        {
            var email = q.ToLowerInvariant();
            target = await _db.Users.AsNoTracking()
                .Include(u => u.AvatarFile)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email && u.IsActive != false);
            if (target != null)
            {
                var priv = await _db.UserPrivacySettings.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == target.Id);
                if (priv != null && !priv.AllowFindByEmail)
                    return Ok(Array.Empty<object>());
            }
        }
        else
        {
            var digits = NormalizePhone(q);
            if (digits.Length == 0)
                return Ok(Array.Empty<object>());
            var users = await _db.Users.AsNoTracking()
                .Include(u => u.AvatarFile)
                .Where(u => u.PhoneNumber != null && u.IsActive != false)
                .ToListAsync();
            target = users.FirstOrDefault(u => NormalizePhone(u.PhoneNumber) == digits);
            if (target != null)
            {
                var priv = await _db.UserPrivacySettings.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == target.Id);
                if (priv != null && !priv.AllowFindByPhone)
                    return Ok(Array.Empty<object>());
            }
        }

        if (target == null || target.Id == me)
            return Ok(Array.Empty<object>());
        if (await IsEitherBlockedAsync(me, target.Id))
            return Ok(Array.Empty<object>());

        return Ok(new[]
        {
            new
            {
                id = target.Id,
                fullName = target.FullName,
                avatarUrl = target.AvatarFile?.FileUrl
            }
        });
    }

    /// <summary>Gợi ý theo tên (realtime — FE debounce).</summary>
    [HttpGet("users/search/name")]
    public async Task<IActionResult> SearchByName([FromQuery] string? q, [FromQuery] int take = 15)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var term = (q ?? string.Empty).Trim();
        if (term.Length < 1)
            return Ok(Array.Empty<object>());
        take = Math.Clamp(take, 1, 30);

        var blockedIds = await _db.UserBlocks.AsNoTracking()
            .Where(b => b.BlockerId == me || b.BlockedId == me)
            .Select(b => b.BlockerId == me ? b.BlockedId : b.BlockerId)
            .ToListAsync();

        var blockedSet = blockedIds.ToHashSet();
        blockedSet.Add(me);

        var list = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .Where(u => u.IsActive != false && u.Id != me)
            .Where(u => EF.Functions.Like(u.FullName, $"%{term}%"))
            .OrderBy(u => u.FullName)
            .Take(take + 5)
            .Select(u => new { u.Id, u.FullName, AvatarUrl = u.AvatarFile != null ? u.AvatarFile.FileUrl : null })
            .ToListAsync();

        var filtered = list.Where(x => !blockedSet.Contains(x.Id)).Take(take)
            .Select(x => new { id = x.Id, fullName = x.FullName, avatarUrl = x.AvatarUrl })
            .ToList();

        return Ok(filtered);
    }

    [HttpPost("friend-requests")]
    public async Task<IActionResult> SendFriendRequest([FromBody] SendRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var toId = dto.ToUserId;
        if (toId == me)
            return BadRequest(new { message = "Bạn không thể gửi lời mời cho chính mình." });
        var other = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == toId && u.IsActive != false);
        if (other == null)
            return NotFound(new { message = "Không tìm thấy người dùng này." });
        if (await IsEitherBlockedAsync(me, toId))
            return BadRequest(new { message = "Không thể gửi lời mời trong trạng thái hiện tại." });

        var (low, high) = OrderedPair(me, toId);
        if (await _db.Friendships.AsNoTracking().AnyAsync(f => f.UserLowId == low && f.UserHighId == high))
            return BadRequest(new { message = "Hai bạn đã là bạn bè rồi." });

        var pendingOut = await _db.FriendRequests.AnyAsync(r =>
            r.Status == "PENDING" && r.FromUserId == me && r.ToUserId == toId);
        if (pendingOut)
            return BadRequest(new { message = "Bạn đã gửi lời mời trước đó rồi." });

        var incoming = await _db.FriendRequests.FirstOrDefaultAsync(r =>
            r.Status == "PENDING" && r.FromUserId == toId && r.ToUserId == me);
        if (incoming != null)
        {
            if (await IsEitherBlockedAsync(me, toId))
                return BadRequest(new { message = "Không thể chấp nhận lời mời trong trạng thái hiện tại." });
            await AcceptPendingFriendRequestAndNotifyAsync(me, incoming, CancellationToken.None);
            return Ok(new
            {
                id = incoming.Id,
                mutualAutoAccept = true,
                message = "Hai bạn đã là bạn bè — lời mời của đối phương đã được chấp nhận."
            });
        }

        var req = new FriendRequest
        {
            Id = Guid.NewGuid(),
            FromUserId = me,
            ToUserId = toId,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        _db.FriendRequests.Add(req);
        await _db.SaveChangesAsync();

        var reversePending = await _db.FriendRequests.FirstOrDefaultAsync(r =>
            r.Status == "PENDING" && r.FromUserId == toId && r.ToUserId == me && r.Id != req.Id);
        if (reversePending != null)
        {
            if (await IsEitherBlockedAsync(me, toId))
            {
                req.Status = "CANCELLED";
                req.RespondedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Không thể kết bạn trong trạng thái hiện tại." });
            }

            await MergeSimultaneousOppositePendingAsync(me, toId, req, reversePending, CancellationToken.None);
            return Ok(new
            {
                id = reversePending.Id,
                simultaneousMutual = true,
                message = "Hai bạn đã là bạn bè — cùng gửi lời mời lúc đó nên hệ thống đã ghép luôn."
            });
        }

        var (lowPair, highPair) = OrderedPair(me, toId);
        if (await _db.Friendships.AsNoTracking()
                .AnyAsync(f => f.UserLowId == lowPair && f.UserHighId == highPair))
        {
            req.Status = "CANCELLED";
            req.RespondedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new
            {
                id = req.Id,
                simultaneousMutual = true,
                message = "Hai bạn đã là bạn bè — đối phương vừa chấp nhận lúc này."
            });
        }

        var fromName = await _db.Users.AsNoTracking().Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        await _notify.NotifyUserAsync(
            toId,
            NotificationTypes.FriendRequest,
            "Lời mời kết bạn",
            $"{fromName} muốn kết bạn với bạn.",
            new { fromUserId = me, requestId = req.Id, deepLink = $"/user/profile/{me}" },
            false,
            null,
            CancellationToken.None);

        return Ok(new { id = req.Id, message = "Đã gửi lời mời kết bạn." });
    }

    public class SendRequestDto
    {
        public Guid ToUserId { get; set; }
    }

    [HttpDelete("friend-requests/sent/{toUserId:guid}")]
    public async Task<IActionResult> CancelSentRequest(Guid toUserId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var r = await _db.FriendRequests.FirstOrDefaultAsync(x =>
            x.FromUserId == me && x.ToUserId == toUserId && x.Status == "PENDING");
        if (r == null)
            return NotFound(new { message = "Không có lời mời đang chờ để thu hồi." });
        r.Status = "CANCELLED";
        r.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã thu hồi lời mời." });
    }

    [HttpPost("friend-requests/{requestId:guid}/accept")]
    public async Task<IActionResult> AcceptRequest(Guid requestId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var r = await _db.FriendRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.ToUserId == me && x.Status == "PENDING");
        if (r == null)
            return NotFound(new { message = "Không tìm thấy lời mời hợp lệ." });
        if (await IsEitherBlockedAsync(me, r.FromUserId))
            return BadRequest(new { message = "Không thể chấp nhận lời mời này." });

        await AcceptPendingFriendRequestAndNotifyAsync(me, r, CancellationToken.None);

        return Ok(new { message = "Đã chấp nhận — giờ hai bạn là bạn bè." });
    }

    [HttpPost("friend-requests/{requestId:guid}/decline")]
    public async Task<IActionResult> DeclineRequest(Guid requestId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var r = await _db.FriendRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.ToUserId == me && x.Status == "PENDING");
        if (r == null)
            return NotFound(new { message = "Không tìm thấy lời mời hợp lệ." });
        r.Status = "DECLINED";
        r.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã từ chối lời mời." });
    }

    [HttpGet("friend-requests/incoming")]
    public async Task<IActionResult> IncomingRequests()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var list = await _db.FriendRequests.AsNoTracking()
            .Where(r => r.ToUserId == me && r.Status == "PENDING")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                id = r.Id,
                fromUserId = r.FromUserId,
                fullName = r.FromUser!.FullName,
                avatarUrl = r.FromUser.AvatarFile != null ? r.FromUser.AvatarFile.FileUrl : null,
                createdAt = r.CreatedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("friend-requests/sent")]
    public async Task<IActionResult> SentRequests()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var list = await _db.FriendRequests.AsNoTracking()
            .Where(r => r.FromUserId == me && r.Status == "PENDING")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                id = r.Id,
                toUserId = r.ToUserId,
                fullName = r.ToUser!.FullName,
                avatarUrl = r.ToUser.AvatarFile != null ? r.ToUser.AvatarFile.FileUrl : null,
                createdAt = r.CreatedAt
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("friends")]
    public async Task<IActionResult> Friends()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var lowRows = await _db.Friendships.AsNoTracking()
            .Where(f => f.UserLowId == me || f.UserHighId == me)
            .ToListAsync();
        var friendIds = lowRows.Select(f => f.UserLowId == me ? f.UserHighId : f.UserLowId).ToList();
        if (friendIds.Count == 0)
            return Ok(Array.Empty<object>());

        var users = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .Where(u => friendIds.Contains(u.Id))
            .Select(u => new { id = u.Id, fullName = u.FullName, avatarUrl = u.AvatarFile != null ? u.AvatarFile.FileUrl : null })
            .OrderBy(u => u.fullName)
            .ToListAsync();
        return Ok(users);
    }

    [HttpDelete("friends/{userId:guid}")]
    public async Task<IActionResult> Unfriend(Guid userId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        if (userId == me)
            return BadRequest();
        var (low, high) = OrderedPair(me, userId);
        var f = await _db.Friendships.FirstOrDefaultAsync(x => x.UserLowId == low && x.UserHighId == high);
        if (f == null)
            return NotFound(new { message = "Hai bạn chưa là bạn bè." });
        _db.Friendships.Remove(f);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã hủy kết bạn." });
    }

    [HttpPost("blocks")]
    public async Task<IActionResult> Block([FromBody] BlockDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var other = dto.BlockedUserId;
        if (other == me)
            return BadRequest(new { message = "Thao tác không áp dụng được." });
        if (!await _db.Users.AsNoTracking().AnyAsync(u => u.Id == other))
            return NotFound(new { message = "Không tìm thấy người dùng." });
        if (await _db.UserBlocks.AnyAsync(b => b.BlockerId == me && b.BlockedId == other))
            return Ok(new { message = "Bạn đã chặn người này trước đó." });

        await CancelPendingBetweenAsync(me, other);
        var (low, high) = OrderedPair(me, other);
        var friendship = await _db.Friendships.FirstOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high);
        if (friendship != null)
            _db.Friendships.Remove(friendship);

        _db.UserBlocks.Add(new UserBlock
        {
            BlockerId = me,
            BlockedId = other,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã chặn người dùng này." });
    }

    public class BlockDto
    {
        public Guid BlockedUserId { get; set; }
    }

    [HttpDelete("blocks/{userId:guid}")]
    public async Task<IActionResult> Unblock(Guid userId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        var b = await _db.UserBlocks.FirstOrDefaultAsync(x => x.BlockerId == me && x.BlockedId == userId);
        if (b == null)
            return NotFound(new { message = "Bạn chưa chặn người này." });
        _db.UserBlocks.Remove(b);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã bỏ chặn." });
    }

    /// <summary>Trạng thái quan hệ với một user (cho nút Kết bạn / v.v.).</summary>
    [HttpGet("relationship/{otherUserId:guid}")]
    public async Task<IActionResult> GetRelationship(Guid otherUserId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();
        if (otherUserId == me)
            return Ok(new { state = "SELF" });
        if (!await _db.Users.AsNoTracking().AnyAsync(u => u.Id == otherUserId && u.IsActive != false))
            return NotFound(new { message = "Không tìm thấy người dùng." });

        if (await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == me && b.BlockedId == otherUserId))
            return Ok(new { state = "BLOCKED_BY_ME" });
        if (await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == otherUserId && b.BlockedId == me))
            return Ok(new { state = "BLOCKED_BY_THEM" });

        var (low, high) = OrderedPair(me, otherUserId);
        if (await _db.Friendships.AsNoTracking().AnyAsync(f => f.UserLowId == low && f.UserHighId == high))
            return Ok(new { state = "FRIENDS" });
        if (await _db.FriendRequests.AsNoTracking().AnyAsync(r => r.Status == "PENDING" && r.FromUserId == me && r.ToUserId == otherUserId))
            return Ok(new { state = "PENDING_OUT" });
        if (await _db.FriendRequests.AsNoTracking().AnyAsync(r => r.Status == "PENDING" && r.FromUserId == otherUserId && r.ToUserId == me))
        {
            var reqId = await _db.FriendRequests.AsNoTracking()
                .Where(r => r.Status == "PENDING" && r.FromUserId == otherUserId && r.ToUserId == me)
                .Select(r => r.Id)
                .FirstAsync();
            return Ok(new { state = "PENDING_IN", requestId = reqId });
        }

        return Ok(new { state = "NONE" });
    }
}

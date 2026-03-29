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
[Route("api/matching")]
[Authorize]
public class MatchingController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public MatchingController(ShuttleUpDbContext db, INotificationDispatchService notify)
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

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts — Danh sách bài đăng OPEN
    // ═══════════════════════════════════════════════════
    [HttpGet("posts")]
    public async Task<IActionResult> GetOpenPosts(
        [FromQuery] string? skillLevel,
        [FromQuery] string? province,
        [FromQuery] DateOnly? playDate,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        if (!TryGetCurrentUserId(out _))
            return Unauthorized();

        var query = _db.MatchingPosts.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Where(p => p.Status == "OPEN");

        // Filters
        if (!string.IsNullOrWhiteSpace(skillLevel))
            query = query.Where(p => p.SkillLevel == skillLevel);
        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);
        if (!string.IsNullOrWhiteSpace(province))
            query = query.Where(p => p.Venue != null && p.Venue.Address.Contains(province));

        // Sort
        query = sort switch
        {
            "price_asc" => query.OrderBy(p => p.PricePerSlot),
            "soonest" => query.OrderBy(p => p.PlayDate).ThenBy(p => p.PlayStartTime),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var result = items.Select(p => MapPostCard(p));
        return Ok(new { total, page, pageSize, items = result });
    }

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts/my — Bài đăng của tôi
    // ═══════════════════════════════════════════════════
    [HttpGet("posts/my")]
    public async Task<IActionResult> GetMyPosts()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var list = await _db.MatchingPosts.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Where(p => p.CreatorUserId == me)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(list.Select(p => new
        {
            id = p.Id,
            title = p.Title,
            playDate = p.PlayDate,
            playStartTime = p.PlayStartTime?.ToString("HH:mm"),
            playEndTime = p.PlayEndTime?.ToString("HH:mm"),
            venueName = p.Venue?.Name,
            venueAddress = p.Venue?.Address,
            courtName = p.CourtName,
            pricePerSlot = p.PricePerSlot,
            requiredPlayers = p.RequiredPlayers,
            skillLevel = p.SkillLevel,
            genderPref = p.GenderPref,
            expenseSharing = p.ExpenseSharing,
            status = p.Status,
            membersCount = p.MatchingMembers.Count,
            pendingRequests = p.MatchingJoinRequests.Count(r => r.Status == "PENDING"),
            createdAt = p.CreatedAt
        }));
    }

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts/{id} — Chi tiết bài đăng
    // ═══════════════════════════════════════════════════
    [HttpGet("posts/{id:guid}")]
    public async Task<IActionResult> GetPostDetail(Guid id)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var p = await _db.MatchingPosts.AsNoTracking()
            .Include(x => x.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.Venue)
            .Include(x => x.MatchingMembers).ThenInclude(m => m.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingJoinRequests.Where(r => r.Status == "PENDING"))
                .ThenInclude(r => r.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingPostItems).ThenInclude(i => i.BookingItem).ThenInclude(b => b.Court)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (p == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });

        var isHost = p.CreatorUserId == me;
        var isMember = p.MatchingMembers.Any(m => m.UserId == me);
        var myJoinRequest = await _db.MatchingJoinRequests.AsNoTracking()
            .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == me && r.Status == "PENDING");

        return Ok(new
        {
            id = p.Id,
            title = p.Title,
            playDate = p.PlayDate,
            playStartTime = p.PlayStartTime?.ToString("HH:mm"),
            playEndTime = p.PlayEndTime?.ToString("HH:mm"),
            venueName = p.Venue?.Name,
            venueAddress = p.Venue?.Address,
            courtName = p.CourtName,
            pricePerSlot = p.PricePerSlot,
            requiredPlayers = p.RequiredPlayers,
            skillLevel = p.SkillLevel,
            genderPref = p.GenderPref,
            expenseSharing = p.ExpenseSharing,
            playPurpose = p.PlayPurpose,
            notes = p.Notes,
            status = p.Status,
            createdAt = p.CreatedAt,

            // Host info
            host = new
            {
                id = p.CreatorUser?.Id,
                fullName = p.CreatorUser?.FullName,
                avatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                skillLevel = p.CreatorUser?.SkillLevel,
                gender = p.CreatorUser?.Gender
            },

            // Members
            members = p.MatchingMembers.Select(m => new
            {
                memberId = m.Id,
                userId = m.UserId,
                fullName = m.User?.FullName,
                avatarUrl = m.User?.AvatarFile?.FileUrl,
                skillLevel = m.User?.SkillLevel,
                gender = m.User?.Gender,
                joinedAt = m.JoinedAt
            }),
            membersCount = p.MatchingMembers.Count,

            // Booking Items (ca chơi)
            bookingItems = p.MatchingPostItems.Select(i => new
            {
                bookingItemId = i.BookingItemId,
                courtName = i.BookingItem?.Court?.Name,
                startTime = i.BookingItem?.StartTime,
                endTime = i.BookingItem?.EndTime,
                price = i.BookingItem?.FinalPrice
            }),

            // Current user context
            isHost,
            isMember,
            myJoinRequestId = myJoinRequest?.Id,
            isPending = myJoinRequest != null,

            // Pending requests (chỉ host thấy)
            pendingRequests = isHost ? p.MatchingJoinRequests.Where(r => r.Status == "PENDING").Select(r => new
            {
                id = r.Id,
                userId = r.UserId,
                fullName = r.User?.FullName,
                avatarUrl = r.User?.AvatarFile?.FileUrl,
                skillLevel = r.User?.SkillLevel,
                gender = r.User?.Gender,
                message = r.Message,
                createdAt = r.CreatedAt
            }) : null
        });
    }

    // ═════════════════════════════════════════════════════
    //  POST /api/matching/posts — Tạo bài đăng matching
    // ═════════════════════════════════════════════════════
    public class CreatePostDto
    {
        public Guid BookingId { get; set; }
        public List<Guid>? BookingItemIds { get; set; }
        public string? Title { get; set; }
        public int RequiredPlayers { get; set; }
        public string? SkillLevel { get; set; }
        public string? GenderPref { get; set; }
        public string? ExpenseSharing { get; set; }
        public string? PlayPurpose { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        if (dto.RequiredPlayers < 1)
            return BadRequest(new { message = "Vui lòng nhập số người cần tìm (ít nhất 1)." });

        // Verify booking belongs to user
        var booking = await _db.Bookings.AsNoTracking()
            .Include(b => b.Venue)
            .FirstOrDefaultAsync(b => b.Id == dto.BookingId && b.UserId == me);
        if (booking == null)
            return BadRequest(new { message = "Không tìm thấy đơn đặt sân này." });

        // Get selected booking items
        var itemIds = dto.BookingItemIds ?? new List<Guid>();
        var items = await _db.BookingItems.AsNoTracking()
            .Include(i => i.Court)
            .Where(i => i.BookingId == dto.BookingId && (itemIds.Count == 0 || itemIds.Contains(i.Id)))
            .OrderBy(i => i.StartTime)
            .ToListAsync();

        if (items.Count == 0)
            return BadRequest(new { message = "Vui lòng chọn ít nhất 1 ca chơi." });

        var firstItem = items.First();
        var lastItem = items.Last();

        var post = new MatchingPost
        {
            Id = Guid.NewGuid(),
            CreatorUserId = me,
            BookingId = dto.BookingId,
            Title = dto.Title ?? $"Tìm {dto.RequiredPlayers} người đánh cầu lông",
            PlayDate = firstItem.StartTime.HasValue ? DateOnly.FromDateTime(firstItem.StartTime.Value) : null,
            PlayStartTime = firstItem.StartTime.HasValue ? TimeOnly.FromDateTime(firstItem.StartTime.Value) : null,
            PlayEndTime = lastItem.EndTime.HasValue ? TimeOnly.FromDateTime(lastItem.EndTime.Value) : null,
            VenueId = booking.VenueId,
            CourtName = firstItem.Court?.Name,
            PricePerSlot = items.Sum(i => i.FinalPrice ?? 0) / Math.Max(dto.RequiredPlayers + 1, 1),
            RequiredPlayers = dto.RequiredPlayers,
            SkillLevel = dto.SkillLevel,
            GenderPref = dto.GenderPref,
            ExpenseSharing = dto.ExpenseSharing,
            PlayPurpose = dto.PlayPurpose,
            Notes = dto.Notes,
            Status = "OPEN",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.MatchingPosts.Add(post);

        // Add post items
        foreach (var item in items)
        {
            _db.MatchingPostItems.Add(new MatchingPostItem
            {
                Id = Guid.NewGuid(),
                PostId = post.Id,
                BookingItemId = item.Id
            });
        }

        // Host auto-becomes a member
        _db.MatchingMembers.Add(new MatchingMember
        {
            Id = Guid.NewGuid(),
            PostId = post.Id,
            UserId = me,
            JoinedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { id = post.Id, message = "Tuyệt vời! Bài đăng đã được tạo thành công." });
    }

    // ═════════════════════════════════════════════════════
    //  PUT /api/matching/posts/{id} — Sửa bài đăng
    // ═════════════════════════════════════════════════════
    public class UpdatePostDto
    {
        public string? Title { get; set; }
        public int? RequiredPlayers { get; set; }
        public string? SkillLevel { get; set; }
        public string? GenderPref { get; set; }
        public string? ExpenseSharing { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPut("posts/{id:guid}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdatePostDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var post = await _db.MatchingPosts.FirstOrDefaultAsync(p => p.Id == id && p.CreatorUserId == me);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });
        if (post.Status != "OPEN")
            return BadRequest(new { message = "Chỉ có thể sửa bài đăng đang mở." });

        if (dto.Title != null) post.Title = dto.Title;
        if (dto.RequiredPlayers.HasValue) post.RequiredPlayers = dto.RequiredPlayers.Value;
        if (dto.SkillLevel != null) post.SkillLevel = dto.SkillLevel;
        if (dto.GenderPref != null) post.GenderPref = dto.GenderPref;
        if (dto.ExpenseSharing != null) post.ExpenseSharing = dto.ExpenseSharing;
        if (dto.Notes != null) post.Notes = dto.Notes;
        post.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật bài đăng." });
    }

    // ═══════════════════════════════════════════════════
    //  POST /api/matching/posts/{id}/close — Đóng bài
    // ═══════════════════════════════════════════════════
    [HttpPost("posts/{id:guid}/close")]
    public async Task<IActionResult> ClosePost(Guid id)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var post = await _db.MatchingPosts
            .Include(p => p.MatchingMembers)
            .FirstOrDefaultAsync(p => p.Id == id && p.CreatorUserId == me);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });

        post.Status = "CLOSED";
        post.UpdatedAt = DateTime.UtcNow;

        // Cancel all pending requests
        var pendingRequests = await _db.MatchingJoinRequests
            .Where(r => r.PostId == id && r.Status == "PENDING")
            .ToListAsync();
        foreach (var r in pendingRequests)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // Notify members
        var hostName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        foreach (var member in post.MatchingMembers.Where(m => m.UserId != me))
        {
            await _notify.NotifyUserAsync(
                member.UserId!.Value,
                NotificationTypes.MatchingPostClosed,
                "Bài đăng đã đóng",
                $"{hostName} đã đóng bài đăng \"{post.Title}\".",
                new { postId = id, deepLink = $"/matching/{id}" });
        }

        return Ok(new { message = "Bài đăng đã được đóng." });
    }

    // ═════════════════════════════════════════════════════
    //  POST /api/matching/posts/{id}/join — Xin tham gia
    // ═════════════════════════════════════════════════════
    public class JoinDto
    {
        public string? Message { get; set; }
    }

    [HttpPost("posts/{id:guid}/join")]
    public async Task<IActionResult> JoinPost(Guid id, [FromBody] JoinDto? dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var post = await _db.MatchingPosts.AsNoTracking()
            .Include(p => p.MatchingMembers)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });
        if (post.Status != "OPEN")
            return BadRequest(new { message = "Bài đăng này không còn nhận thành viên mới." });
        if (post.CreatorUserId == me)
            return BadRequest(new { message = "Bạn đã là chủ bài đăng." });

        // Already a member?
        if (post.MatchingMembers.Any(m => m.UserId == me))
            return BadRequest(new { message = "Bạn đã là thành viên của nhóm này." });

        // Already has pending request?
        var existing = await _db.MatchingJoinRequests
            .AnyAsync(r => r.PostId == id && r.UserId == me && r.Status == "PENDING");
        if (existing)
            return BadRequest(new { message = "Bạn đã gửi yêu cầu trước đó rồi." });

        // Check if group is full
        if (post.MatchingMembers.Count >= (post.RequiredPlayers ?? 0) + 1) // +1 for host
            return BadRequest(new { message = "Nhóm đã đủ người rồi." });

        var request = new MatchingJoinRequest
        {
            Id = Guid.NewGuid(),
            PostId = id,
            UserId = me,
            Message = dto?.Message,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        _db.MatchingJoinRequests.Add(request);
        await _db.SaveChangesAsync();

        // Notify host
        var myName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        await _notify.NotifyUserAsync(
            post.CreatorUserId!.Value,
            NotificationTypes.MatchingJoinRequest,
            "Yêu cầu tham gia mới",
            $"{myName} muốn tham gia \"{post.Title}\".",
            new { postId = id, requestId = request.Id, deepLink = $"/matching/{id}" });

        return Ok(new { id = request.Id, message = "Đã gửi yêu cầu tham gia. Hãy chờ chủ bài duyệt nhé!" });
    }

    // ═══════════════════════════════════════════════════════
    //  DELETE /api/matching/posts/{id}/join — Hủy yêu cầu
    // ═══════════════════════════════════════════════════════
    [HttpDelete("posts/{id:guid}/join")]
    public async Task<IActionResult> CancelJoinRequest(Guid id)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var request = await _db.MatchingJoinRequests
            .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == me && r.Status == "PENDING");
        if (request == null)
            return NotFound(new { message = "Không có yêu cầu đang chờ để hủy." });

        request.Status = "CANCELLED";
        request.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã hủy yêu cầu tham gia." });
    }

    // ═══════════════════════════════════════════════════════════
    //  POST /api/matching/join-requests/{id}/accept — Duyệt
    // ═══════════════════════════════════════════════════════════
    [HttpPost("join-requests/{id:guid}/accept")]
    public async Task<IActionResult> AcceptJoinRequest(Guid id)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var request = await _db.MatchingJoinRequests
            .Include(r => r.Post).ThenInclude(p => p!.MatchingMembers)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (request == null)
            return NotFound(new { message = "Không tìm thấy yêu cầu." });
        if (request.Post?.CreatorUserId != me)
            return Forbid();
        if (request.Status != "PENDING")
            return BadRequest(new { message = "Yêu cầu này đã được xử lý." });

        // Over-join protection
        var currentMembers = request.Post.MatchingMembers.Count;
        var maxMembers = (request.Post.RequiredPlayers ?? 0) + 1; // +1 host
        if (currentMembers >= maxMembers)
            return BadRequest(new { message = "Nhóm đã đủ người. Không thể chấp nhận thêm." });

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            request.Status = "ACCEPTED";
            request.UpdatedAt = DateTime.UtcNow;

            _db.MatchingMembers.Add(new MatchingMember
            {
                Id = Guid.NewGuid(),
                PostId = request.PostId,
                UserId = request.UserId,
                JoinedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();

            // Auto-close if full
            var newCount = currentMembers + 1;
            if (newCount >= maxMembers)
            {
                request.Post.Status = "FULL";
                request.Post.UpdatedAt = DateTime.UtcNow;

                // Cancel remaining pending requests
                var remaining = await _db.MatchingJoinRequests
                    .Where(r => r.PostId == request.PostId && r.Status == "PENDING")
                    .ToListAsync();
                foreach (var r in remaining)
                {
                    r.Status = "CANCELLED";
                    r.UpdatedAt = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();
            }

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        // Notify accepted user
        var hostName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        await _notify.NotifyUserAsync(
            request.UserId!.Value,
            NotificationTypes.MatchingJoinAccepted,
            "Đã được chấp nhận! 🎉",
            $"{hostName} đã chấp nhận bạn vào nhóm \"{request.Post.Title}\".",
            new { postId = request.PostId, deepLink = $"/matching/{request.PostId}" });

        return Ok(new { message = "Đã chấp nhận thành viên mới vào nhóm." });
    }

    // ═══════════════════════════════════════════════════════
    //  POST /api/matching/join-requests/{id}/reject — Từ chối
    // ═══════════════════════════════════════════════════════
    public class RejectDto
    {
        public string? Reason { get; set; }
    }

    [HttpPost("join-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectJoinRequest(Guid id, [FromBody] RejectDto? dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var request = await _db.MatchingJoinRequests
            .Include(r => r.Post)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (request == null)
            return NotFound(new { message = "Không tìm thấy yêu cầu." });
        if (request.Post?.CreatorUserId != me)
            return Forbid();
        if (request.Status != "PENDING")
            return BadRequest(new { message = "Yêu cầu này đã được xử lý." });

        request.Status = "REJECTED";
        request.RejectReason = dto?.Reason;
        request.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify rejected user
        var hostName = await _db.Users.AsNoTracking()
            .Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
        await _notify.NotifyUserAsync(
            request.UserId!.Value,
            NotificationTypes.MatchingJoinRejected,
            "Yêu cầu chưa được duyệt",
            $"Yêu cầu tham gia \"{request.Post.Title}\" chưa được duyệt." +
            (string.IsNullOrWhiteSpace(dto?.Reason) ? "" : $" Lý do: {dto!.Reason}"),
            new { postId = request.PostId, deepLink = $"/matching/{request.PostId}" });

        return Ok(new { message = "Đã từ chối yêu cầu." });
    }

    // ═══════════════════════════════════════════════════════════
    //  DELETE /api/matching/members/{memberId} — Kick hoặc Rời
    // ═══════════════════════════════════════════════════════════
    [HttpDelete("members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid memberId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var member = await _db.MatchingMembers
            .Include(m => m.Post)
            .FirstOrDefaultAsync(m => m.Id == memberId);
        if (member == null)
            return NotFound(new { message = "Không tìm thấy thành viên." });

        var isHost = member.Post?.CreatorUserId == me;
        var isSelf = member.UserId == me;

        if (!isHost && !isSelf)
            return Forbid();

        // Host can't remove themselves
        if (isHost && isSelf)
            return BadRequest(new { message = "Chủ bài đăng không thể rời nhóm. Hãy đóng bài đăng." });

        _db.MatchingMembers.Remove(member);

        // If post was FULL, reopen it
        if (member.Post?.Status == "FULL")
        {
            member.Post.Status = "OPEN";
            member.Post.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // Notify
        if (isHost && !isSelf)
        {
            // Host kicked player
            var hostName = await _db.Users.AsNoTracking()
                .Where(u => u.Id == me).Select(u => u.FullName).FirstAsync();
            await _notify.NotifyUserAsync(
                member.UserId!.Value,
                NotificationTypes.MatchingMemberKicked,
                "Bạn đã rời nhóm",
                $"Bạn đã bị xóa khỏi nhóm \"{member.Post?.Title}\" bởi {hostName}.",
                new { postId = member.PostId, deepLink = "/matching" });
        }

        return Ok(new { message = isSelf ? "Bạn đã rời khỏi nhóm." : "Đã xóa thành viên khỏi nhóm." });
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/matching/posts/{id}/comments — Load comments (FB)
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("posts/{id:guid}/comments")]
    public async Task<IActionResult> GetComments(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        // Only host + accepted members can see comments
        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == id && m.UserId == me);
        if (!isMember)
            return Forbid();

        var total = await _db.MatchingPostComments.CountAsync(c => c.PostId == id);
        var items = await _db.MatchingPostComments.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u.AvatarFile)
            .Where(c => c.PostId == id)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                id = c.Id,
                userId = c.UserId,
                fullName = c.User.FullName,
                avatarUrl = c.User.AvatarFile != null ? c.User.AvatarFile.FileUrl : null,
                content = c.Content,
                createdAt = c.CreatedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /api/matching/posts/{id}/comments — Gửi comment (FB)
    // ═══════════════════════════════════════════════════════════════
    public class CommentDto
    {
        public string Content { get; set; } = null!;
    }

    [HttpPost("posts/{id:guid}/comments")]
    public async Task<IActionResult> PostComment(Guid id, [FromBody] CommentDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Vui lòng nhập nội dung bình luận." });

        // Only host + accepted members can comment
        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == id && m.UserId == me);
        if (!isMember)
            return Forbid();

        var comment = new MatchingPostComment
        {
            Id = Guid.NewGuid(),
            PostId = id,
            UserId = me,
            Content = dto.Content.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        _db.MatchingPostComments.Add(comment);
        await _db.SaveChangesAsync();

        var user = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .FirstAsync(u => u.Id == me);

        return Ok(new
        {
            id = comment.Id,
            userId = me,
            fullName = user.FullName,
            avatarUrl = user.AvatarFile?.FileUrl,
            content = comment.Content,
            createdAt = comment.CreatedAt,
            message = "Bình luận đã được gửi."
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/matching/bookings — Load upcoming bookings (Create flow)
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("bookings")]
    public async Task<IActionResult> GetUpcomingBookings()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var now = DateTime.UtcNow;
        var bookings = await _db.Bookings.AsNoTracking()
            .Include(b => b.Venue)
            .Include(b => b.BookingItems).ThenInclude(i => i.Court)
            .Where(b => b.UserId == me && b.Status == "CONFIRMED")
            .Where(b => b.BookingItems.Any(i => i.StartTime > now))
            .OrderByDescending(b => b.CreatedAt)
            .Take(20)
            .ToListAsync();

        return Ok(bookings.Select(b => new
        {
            id = b.Id,
            venueName = b.Venue?.Name,
            venueAddress = b.Venue?.Address,
            venueId = b.VenueId,
            totalAmount = b.TotalAmount,
            finalAmount = b.FinalAmount,
            createdAt = b.CreatedAt,
            items = b.BookingItems
                .Where(i => i.StartTime > now)
                .OrderBy(i => i.StartTime)
                .Select(i => new
                {
                    id = i.Id,
                    courtName = i.Court?.Name,
                    startTime = i.StartTime,
                    endTime = i.EndTime,
                    price = i.FinalPrice,
                    status = i.Status
                })
        }));
    }

    // ═══════════════════════════════════════════
    //  Helper — map post to card DTO
    // ═══════════════════════════════════════════
    private static object MapPostCard(MatchingPost p) => new
    {
        id = p.Id,
        title = p.Title,
        playDate = p.PlayDate,
        playStartTime = p.PlayStartTime?.ToString("HH:mm"),
        playEndTime = p.PlayEndTime?.ToString("HH:mm"),
        venueName = p.Venue?.Name,
        venueAddress = p.Venue?.Address,
        courtName = p.CourtName,
        pricePerSlot = p.PricePerSlot,
        requiredPlayers = p.RequiredPlayers,
        skillLevel = p.SkillLevel,
        genderPref = p.GenderPref,
        expenseSharing = p.ExpenseSharing,
        status = p.Status,
        membersCount = p.MatchingMembers.Count,
        createdAt = p.CreatedAt,
        host = new
        {
            id = p.CreatorUser?.Id,
            fullName = p.CreatorUser?.FullName,
            avatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
            skillLevel = p.CreatorUser?.SkillLevel
        }
    };
}

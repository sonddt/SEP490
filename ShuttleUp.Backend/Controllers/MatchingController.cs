using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.Backend.Utils;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/matching")]
[Authorize]
public class MatchingController : ControllerBase
{
    private const int CommentContentMaxLength = 2000;

    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;
    private readonly IFileService _fileService;
    private readonly IMatchingPostActivityService _activity;

    public MatchingController(
        ShuttleUpDbContext db,
        INotificationDispatchService notify,
        IFileService fileService,
        IMatchingPostActivityService activity)
    {
        _db = db;
        _notify = notify;
        _fileService = fileService;
        _activity = activity;
    }

    private static bool IsInactiveStatus(string? status) =>
        string.Equals(status, "Inactive", StringComparison.OrdinalIgnoreCase);

    private async Task<bool> IsPostInactiveAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var st = await _db.MatchingPosts.AsNoTracking()
            .Where(p => p.Id == postId)
            .Select(p => p.Status)
            .FirstOrDefaultAsync(cancellationToken);
        return IsInactiveStatus(st);
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    /// <summary>MySQL datetime → JSON có hậu tố Z để FE không hiểu nhầm là giờ local (lệch ~7h VN).</summary>
    private static DateTime AsUtcForJson(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
    }

    private static DateTime? AsUtcForJson(DateTime? dt) =>
        dt.HasValue ? AsUtcForJson(dt.Value) : null;

    private static DateTime AsUtcForCompare(DateTime dt) =>
        dt.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(dt, DateTimeKind.Utc)
            : dt.ToUniversalTime();

    private static Dictionary<Guid, decimal> BuildActualItemPriceMap(Booking booking)
    {
        var itemPrices = (booking.BookingItems ?? new List<BookingItem>())
            .Where(i => i.Id != Guid.Empty)
            .ToDictionary(i => i.Id, i => i.FinalPrice ?? 0m);

        if (itemPrices.Count == 0)
            return itemPrices;

        var totalAmount = booking.TotalAmount ?? 0m;
        var finalAmount = booking.FinalAmount ?? totalAmount;
        if (totalAmount <= 0m || finalAmount <= 0m)
            return itemPrices;

        var ratio = finalAmount / totalAmount;
        if (ratio >= 0.999999m && ratio <= 1.000001m)
            return itemPrices;

        var orderedItems = booking.BookingItems!
            .OrderBy(i => i.StartTime)
            .ThenBy(i => i.Id)
            .ToList();

        var targetTotal = finalAmount;
        decimal distributed = 0m;
        var actualMap = new Dictionary<Guid, decimal>(orderedItems.Count);

        for (var idx = 0; idx < orderedItems.Count; idx++)
        {
            var item = orderedItems[idx];
            var original = item.FinalPrice ?? 0m;
            decimal actual;

            if (idx == orderedItems.Count - 1)
            {
                actual = targetTotal - distributed;
            }
            else
            {
                actual = Math.Round(original * ratio, 0, MidpointRounding.AwayFromZero);
                distributed += actual;
            }

            actualMap[item.Id] = Math.Max(actual, 0m);
        }

        return actualMap;
    }

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts — Danh sách bài đăng OPEN
    // ═══════════════════════════════════════════════════
    [HttpGet("posts")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOpenPosts(
        [FromQuery] string? skillLevel,
        [FromQuery] string? province,
        [FromQuery] DateOnly? playDate,
        [FromQuery] string? sort,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        TryGetCurrentUserId(out var me);

        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(HttpContext.RequestAborted);

        var localTime = DateTime.Now;
        var query = _db.MatchingPosts.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Include(p => p.MatchingPostItems).ThenInclude(i => i.BookingItem)
            .Where(p => p.Status == "OPEN" || p.Status == "FULL")
            .Where(p => p.MatchingPostItems.Any(i =>
                i.BookingItem != null
                && i.BookingItem.StartTime.HasValue
                && i.BookingItem.StartTime.Value > localTime));

        // Filters
        if (!string.IsNullOrWhiteSpace(skillLevel))
            query = query.Where(p => p.SkillLevel == skillLevel);
        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);
        if (!string.IsNullOrWhiteSpace(province))
            query = query.Where(p => p.Venue != null && p.Venue.Address.Contains(province));

        var hasSearch = !string.IsNullOrWhiteSpace(q);
        var foldQ = hasSearch ? SearchNormalize.Fold(q) : "";

        // Sort
        query = sort switch
        {
            "price_asc" => query.OrderBy(p => p.PricePerSlot),
            "price_desc" => query.OrderByDescending(p => p.PricePerSlot),
            "soonest" => query.OrderBy(p => p.PlayDate).ThenBy(p => p.PlayStartTime),
            "oldest" => query.OrderBy(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        int total;
        List<MatchingPost> items;
        if (!hasSearch)
        {
            total = await query.CountAsync();
            items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        }
        else
        {
            var all = await query.ToListAsync();
            var filtered = all.Where(p =>
                SearchNormalize.FoldedContains(p.Title, foldQ)
                || SearchNormalize.FoldedContains(p.Venue?.Name, foldQ)
                || SearchNormalize.FoldedContains(p.CourtName, foldQ)
                || SearchNormalize.FoldedContains(p.Venue?.Address, foldQ)
                || SearchNormalize.FoldedContains(p.CreatorUser?.FullName, foldQ)).ToList();
            total = filtered.Count;
            items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        }

        var result = items.Select(p => MapPostCard(p, me));
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

        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(HttpContext.RequestAborted);

        var list = await _db.MatchingPosts.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Where(p => p.CreatorUserId == me)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(list.Select(p =>
        {
            var filled = p.MatchingMembers.Count;
            var totalSlots = (p.RequiredPlayers ?? 0) + 1;
            var slotsLeft = Math.Max(totalSlots - filled, 0);
            var isHost = p.CreatorUserId == me;
            var isMember = p.MatchingMembers.Any(m => m.UserId == me);
            var isPending = p.MatchingJoinRequests.Any(r => r.UserId == me && r.Status == "PENDING");
            var canRequestJoin = !isHost && !isMember && !isPending && p.Status == "OPEN" && slotsLeft > 0
                && !IsInactiveStatus(p.Status);
            return new
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
                status = p.Status,
                membersCount = filled,
                pendingRequests = p.MatchingJoinRequests.Count(r => r.Status == "PENDING"),
                createdAt = p.CreatedAt,
                isHost,
                isMember,
                isPending,
                canRequestJoin,
                host = new
                {
                    id = p.CreatorUser?.Id,
                    fullName = p.CreatorUser?.FullName,
                    avatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                    skillLevel = p.CreatorUser?.SkillLevel
                }
            };
        }));
    }

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts/joined — Bài đã tham gia (không phải chủ bài)
    // ═══════════════════════════════════════════════════
    [HttpGet("posts/joined")]
    public async Task<IActionResult> GetJoinedPosts()
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(HttpContext.RequestAborted);

        var list = await _db.MatchingPosts.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Where(p => p.CreatorUserId != me && p.MatchingMembers.Any(m => m.UserId == me))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(list.Select(p =>
        {
            var filled = p.MatchingMembers.Count;
            var totalSlots = (p.RequiredPlayers ?? 0) + 1;
            var slotsLeft = Math.Max(totalSlots - filled, 0);
            var isHost = p.CreatorUserId == me;
            var isMember = p.MatchingMembers.Any(m => m.UserId == me);
            var isPending = p.MatchingJoinRequests.Any(r => r.UserId == me && r.Status == "PENDING");
            var canRequestJoin = !isHost && !isMember && !isPending && p.Status == "OPEN" && slotsLeft > 0
                && !IsInactiveStatus(p.Status);
            return new
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
                status = p.Status,
                membersCount = filled,
                pendingRequests = p.MatchingJoinRequests.Count(r => r.Status == "PENDING"),
                createdAt = p.CreatedAt,
                isHost,
                isMember,
                isPending,
                canRequestJoin,
                host = new
                {
                    id = p.CreatorUser?.Id,
                    fullName = p.CreatorUser?.FullName,
                    avatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                    skillLevel = p.CreatorUser?.SkillLevel
                }
            };
        }));
    }

    // ═══════════════════════════════════════════════════
    //  GET /api/matching/posts/{id} — Chi tiết bài đăng
    // ═══════════════════════════════════════════════════
    [HttpGet("posts/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPostDetail(Guid id)
    {
        TryGetCurrentUserId(out var me);

        await _activity.EnsurePostInactiveIfElapsedAsync(id, HttpContext.RequestAborted);

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
        var myMemberId = p.MatchingMembers.FirstOrDefault(m => m.UserId == me)?.Id;
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
                startTime = AsUtcForJson(i.BookingItem?.StartTime),
                endTime = AsUtcForJson(i.BookingItem?.EndTime),
                price = i.BookingItem?.FinalPrice
            }),

            // Current user context
            isHost,
            isMember,
            myMemberId,
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
            .Include(b => b.BookingItems)
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

        var actualItemPriceMap = BuildActualItemPriceMap(booking);
        var actualSelectedTotal = items.Sum(i => actualItemPriceMap.GetValueOrDefault(i.Id, i.FinalPrice ?? 0m));

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
            PricePerSlot = dto.ExpenseSharing switch
            {
                "host_pays" => 0,
                "negotiable" => null,
                _ => actualSelectedTotal / Math.Max(dto.RequiredPlayers + 1, 1)
            },
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
        public string? PlayPurpose { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPut("posts/{id:guid}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdatePostDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var post = await _db.MatchingPosts
            .Include(p => p.MatchingMembers)
            .FirstOrDefaultAsync(p => p.Id == id && p.CreatorUserId == me);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });
        if (IsInactiveStatus(post.Status))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể chỉnh sửa." });
        if (post.Status != "OPEN")
            return BadRequest(new { message = "Chỉ có thể sửa bài đăng đang mở." });

        if (dto.RequiredPlayers.HasValue)
        {
            if (dto.RequiredPlayers.Value < 1)
                return BadRequest(new { message = "Số người cần tìm ít nhất là 1." });
            var maxMembers = dto.RequiredPlayers.Value + 1;
            if (post.MatchingMembers.Count > maxMembers)
                return BadRequest(new { message = "Số người cần tìm không thể nhỏ hơn số thành viên hiện có trong nhóm." });
            post.RequiredPlayers = dto.RequiredPlayers.Value;

            // Recalculate PricePerSlot
            if (post.ExpenseSharing != "host_pays" && post.ExpenseSharing != "negotiable")
            {
                var items = await _db.MatchingPostItems.AsNoTracking()
                    .Include(i => i.BookingItem)
                    .Where(i => i.PostId == id)
                    .Select(i => i.BookingItem)
                    .ToListAsync();
                var bookingForPrice = await _db.Bookings.AsNoTracking()
                    .Include(b => b.BookingItems)
                    .FirstOrDefaultAsync(b => b.Id == post.BookingId);
                var actualMap = bookingForPrice != null
                    ? BuildActualItemPriceMap(bookingForPrice)
                    : null;
                var totalMoney = items.Sum(i =>
                    i == null
                        ? 0m
                        : actualMap?.GetValueOrDefault(i.Id, i.FinalPrice ?? 0m) ?? (i.FinalPrice ?? 0m));
                post.PricePerSlot = totalMoney / Math.Max((post.RequiredPlayers ?? 0) + 1, 1);
            }
        }

        if (dto.Title != null) post.Title = dto.Title;
        if (dto.SkillLevel != null) post.SkillLevel = dto.SkillLevel;
        if (dto.GenderPref != null) post.GenderPref = dto.GenderPref;
        if (dto.ExpenseSharing != null)
        {
            post.ExpenseSharing = dto.ExpenseSharing;
            // Update PricePerSlot based on new sharing method
            var items = await _db.MatchingPostItems.AsNoTracking()
                .Include(i => i.BookingItem)
                .Where(i => i.PostId == id)
                .Select(i => i.BookingItem)
                .ToListAsync();
            
            var bookingForPrice = await _db.Bookings.AsNoTracking()
                .Include(b => b.BookingItems)
                .FirstOrDefaultAsync(b => b.Id == post.BookingId);
            var actualMap = bookingForPrice != null
                ? BuildActualItemPriceMap(bookingForPrice)
                : null;
            var totalMoney = items.Sum(i =>
                i == null
                    ? 0m
                    : actualMap?.GetValueOrDefault(i.Id, i.FinalPrice ?? 0m) ?? (i.FinalPrice ?? 0m));
            var people = (post.RequiredPlayers ?? 0) + 1;

            post.PricePerSlot = dto.ExpenseSharing switch
            {
                "host_pays" => 0,
                "negotiable" => null,
                _ => totalMoney / Math.Max(people, 1)
            };
        }
        if (dto.PlayPurpose != null) post.PlayPurpose = dto.PlayPurpose;
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
        if (IsInactiveStatus(post.Status))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể đóng tuyển người." });

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

    // ═══════════════════════════════════════════════════
    //  POST /api/matching/posts/{id}/reopen — Mở lại bài (chủ bài)
    // ═══════════════════════════════════════════════════
    [HttpPost("posts/{id:guid}/reopen")]
    public async Task<IActionResult> ReopenPost(Guid id)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var post = await _db.MatchingPosts
            .Include(p => p.MatchingMembers)
            .FirstOrDefaultAsync(p => p.Id == id && p.CreatorUserId == me);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });
        if (post.Status != "CLOSED")
            return BadRequest(new { message = "Chỉ có thể mở lại khi bài đăng đang ở trạng thái đã đóng." });

        var maxMembers = (post.RequiredPlayers ?? 0) + 1;
        var count = post.MatchingMembers.Count;
        post.Status = count >= maxMembers ? "FULL" : "OPEN";
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = post.Status == "FULL"
                ? "Đã mở lại — nhóm vẫn đủ người nên bài ở trạng thái đầy chỗ."
                : "Đã mở lại bài đăng — người chơi có thể xin tham gia trở lại.",
            status = post.Status
        });
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
        if (IsInactiveStatus(post.Status))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể xin tham gia." });
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

        Guid postId;
        Guid acceptedUserId;
        string postTitle;

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var request = await _db.MatchingJoinRequests
                .Include(r => r.Post)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (request == null)
            {
                await tx.RollbackAsync();
                return NotFound(new { message = "Không tìm thấy yêu cầu." });
            }

            if (request.Post?.CreatorUserId != me)
            {
                await tx.RollbackAsync();
                return Forbid();
            }

            if (IsInactiveStatus(request.Post?.Status))
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Bài đăng đã kết thúc — không thể duyệt tham gia." });
            }

            if (request.Status != "PENDING")
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Yêu cầu này đã được xử lý." });
            }

            if (!request.PostId.HasValue)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Yêu cầu tham gia không hợp lệ." });
            }

            postId = request.PostId.Value;
            acceptedUserId = request.UserId ?? Guid.Empty;
            postTitle = request.Post?.Title ?? string.Empty;

            // Serialize concurrent accepts on the same post
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT id FROM matching_posts WHERE id = {postId} FOR UPDATE");

            var maxMembers = (request.Post?.RequiredPlayers ?? 0) + 1; // +1 host
            var currentMembers = await _db.MatchingMembers.CountAsync(m => m.PostId == postId);
            if (currentMembers >= maxMembers)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Nhóm đã đủ người. Không thể chấp nhận thêm." });
            }

            if (request.UserId == null)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Yêu cầu tham gia không hợp lệ." });
            }

            // Already a member? (also avoids unique constraint exceptions)
            var alreadyMember = await _db.MatchingMembers
                .AnyAsync(m => m.PostId == postId && m.UserId == request.UserId);
            if (alreadyMember)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = "Người chơi này đã là thành viên của nhóm." });
            }

            request.Status = "ACCEPTED";
            request.UpdatedAt = DateTime.UtcNow;

            _db.MatchingMembers.Add(new MatchingMember
            {
                Id = Guid.NewGuid(),
                PostId = postId,
                UserId = request.UserId,
                JoinedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();

            // Auto-close if full
            var newCount = await _db.MatchingMembers.CountAsync(m => m.PostId == postId);
            if (newCount >= maxMembers)
            {
                if (request.Post != null)
                {
                    request.Post.Status = "FULL";
                    request.Post.UpdatedAt = DateTime.UtcNow;
                }

                // Cancel remaining pending requests
                var remaining = await _db.MatchingJoinRequests
                    .Where(r => r.PostId == postId && r.Status == "PENDING")
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
            acceptedUserId,
            NotificationTypes.MatchingJoinAccepted,
            "Đã được chấp nhận! 🎉",
            $"{hostName} đã chấp nhận bạn vào nhóm \"{postTitle}\".",
            new { postId, deepLink = $"/matching/{postId}" });

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
        if (IsInactiveStatus(request.Post?.Status))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể xử lý yêu cầu." });
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

        var postIdForRefresh = member.PostId;

        _db.MatchingMembers.Remove(member);

        if (member.Post?.Status == "FULL")
        {
            member.Post.Status = "OPEN";
            member.Post.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        if (postIdForRefresh.HasValue)
            await _activity.EnsurePostInactiveIfElapsedAsync(postIdForRefresh.Value, HttpContext.RequestAborted);

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
    //  GET /api/matching/posts/{id}/comments — Bình luận gốc (paginate) + replyCount + sort
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("posts/{id:guid}/comments")]
    public async Task<IActionResult> GetCommentRoots(
        Guid id,
        [FromQuery] string sort = "newest",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == id && m.UserId == me);
        if (!isMember)
            return Forbid();

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 50) pageSize = 50;

        var replyCounts = await _db.MatchingPostComments.AsNoTracking()
            .Where(r => r.PostId == id && !r.IsDeleted && r.ParentCommentId != null)
            .GroupBy(r => r.ParentCommentId!)
            .Select(g => new { ParentId = g.Key, Cnt = g.Count() })
            .ToListAsync();
        var replyCountByRoot = new Dictionary<Guid, int>();
        foreach (var x in replyCounts)
        {
            var pid = x.ParentId;
            if (pid != null)
                replyCountByRoot[pid.Value] = x.Cnt;
        }

        var rootsQuery = _db.MatchingPostComments.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.AttachmentFile)
            .Where(c => c.PostId == id && !c.IsDeleted && c.ParentCommentId == null);

        var roots = await rootsQuery.ToListAsync();
        var totalRoots = roots.Count;
        var totalAll = totalRoots + replyCounts.Sum(x => (int)x.Cnt);

        IEnumerable<MatchingPostComment> ordered = sort switch
        {
            "oldest" => roots.OrderBy(c => c.CreatedAt),
            "popular" => roots
                .OrderByDescending(c => replyCountByRoot.GetValueOrDefault(c.Id, 0))
                .ThenByDescending(c => c.CreatedAt),
            _ => roots.OrderByDescending(c => c.CreatedAt)
        };

        var pageItems = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = pageItems.Select(c => new
        {
            id = c.Id,
            userId = c.UserId,
            fullName = c.User.FullName,
            avatarUrl = c.User.AvatarFile?.FileUrl,
            content = c.Content,
            createdAt = AsUtcForJson(c.CreatedAt),
            updatedAt = AsUtcForJson(c.UpdatedAt),
            isEdited = c.UpdatedAt.HasValue,
            parentCommentId = (Guid?)null,
            replyToFullName = (string?)null,
            replyCount = replyCountByRoot.GetValueOrDefault(c.Id, 0),
            attachmentFileId = c.AttachmentFileId,
            imageUrl = c.AttachmentFile?.FileUrl
        }).ToList();

        return Ok(new
        {
            total = totalRoots,
            totalAll,
            page,
            pageSize,
            sort,
            items
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/matching/posts/{postId}/comments/{rootId}/replies — Lazy load phản hồi
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("posts/{postId:guid}/comments/{rootId:guid}/replies")]
    public async Task<IActionResult> GetCommentReplies(Guid postId, Guid rootId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == postId && m.UserId == me);
        if (!isMember)
            return Forbid();

        var root = await _db.MatchingPostComments.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == rootId && c.PostId == postId && !c.IsDeleted && c.ParentCommentId == null);
        if (root == null)
            return NotFound(new { message = "Không tìm thấy bình luận gốc." });

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 100) pageSize = 100;

        var total = await _db.MatchingPostComments.CountAsync(c =>
            c.PostId == postId && !c.IsDeleted && c.ParentCommentId == rootId);

        var raw = await _db.MatchingPostComments.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.ParentComment).ThenInclude(p => p!.User)
            .Include(c => c.AttachmentFile)
            .Where(c => c.PostId == postId && !c.IsDeleted && c.ParentCommentId == rootId)
            .OrderBy(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = raw.Select(c =>
        {
            string? replyToFullName = null;
            if (c.ParentComment != null && !c.ParentComment.IsDeleted)
                replyToFullName = c.ParentComment.User.FullName;
            return new
            {
                id = c.Id,
                userId = c.UserId,
                fullName = c.User.FullName,
                avatarUrl = c.User.AvatarFile?.FileUrl,
                content = c.Content,
                createdAt = AsUtcForJson(c.CreatedAt),
                updatedAt = AsUtcForJson(c.UpdatedAt),
                isEdited = c.UpdatedAt.HasValue,
                parentCommentId = c.ParentCommentId,
                replyToFullName,
                replyCount = 0,
                attachmentFileId = c.AttachmentFileId,
                imageUrl = c.AttachmentFile?.FileUrl
            };
        }).ToList();

        return Ok(new { total, page, pageSize, rootId, items });
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /api/matching/posts/{postId}/comments/upload-image
    // ═══════════════════════════════════════════════════════════════
    [HttpPost("posts/{postId:guid}/comments/upload-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadCommentImage(Guid postId, IFormFile file)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == postId && m.UserId == me);
        if (!isMember)
            return Forbid();
        if (await IsPostInactiveAsync(postId))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể đính kèm ảnh bình luận." });

        if (file == null || file.Length <= 0)
            return BadRequest(new { message = "Vui lòng chọn ảnh." });
        if (file.ContentType == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ được đính kèm file ảnh." });

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadMatchingCommentImageAsync(file, postId, me, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message });
        }

        var fileRow = new ShuttleUp.DAL.Models.File
        {
            Id = Guid.NewGuid(),
            FileUrl = secureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = me,
            CreatedAt = DateTime.UtcNow
        };
        _db.Files.Add(fileRow);
        await _db.SaveChangesAsync();

        return Ok(new { fileId = fileRow.Id, url = secureUrl });
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /api/matching/posts/{id}/comments — Gửi comment (FB)
    // ═══════════════════════════════════════════════════════════════
    public class CommentDto
    {
        public string Content { get; set; } = null!;

        /// <summary>Trả lời bình luận gốc (không trả lời bình luận đã là reply).</summary>
        public Guid? ParentCommentId { get; set; }

        /// <summary>File ảnh đã upload qua POST .../comments/upload-image.</summary>
        public Guid? AttachmentFileId { get; set; }
    }

    [HttpPost("posts/{id:guid}/comments")]
    public async Task<IActionResult> PostComment(Guid id, [FromBody] CommentDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == id && m.UserId == me);
        if (!isMember)
            return Forbid();
        if (await IsPostInactiveAsync(id))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể gửi bình luận mới." });

        string? replyToFullName = null;
        Guid? parentId = null;
        Guid? parentAuthorId = null;
        if (dto.ParentCommentId.HasValue)
        {
            var parent = await _db.MatchingPostComments.AsNoTracking()
                .Include(p => p.User)
                .FirstOrDefaultAsync(c => c.Id == dto.ParentCommentId.Value && c.PostId == id);
            if (parent == null || parent.IsDeleted)
                return BadRequest(new { message = "Không tìm thấy bình luận để trả lời." });
            if (parent.ParentCommentId != null)
                return BadRequest(new { message = "Chỉ trả lời được một cấp — hãy trả lời bình luận gốc." });
            parentId = parent.Id;
            parentAuthorId = parent.UserId;
            replyToFullName = parent.User.FullName;
        }

        Guid? attachmentId = null;
        string? imageUrl = null;
        if (dto.AttachmentFileId.HasValue)
        {
            var att = await _db.Files.AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == dto.AttachmentFileId.Value);
            if (att == null || att.UploadedByUserId != me)
                return BadRequest(new { message = "Ảnh đính kèm không hợp lệ." });
            if (string.IsNullOrEmpty(att.MimeType) || !att.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Chỉ được đính kèm file ảnh." });
            attachmentId = att.Id;
            imageUrl = att.FileUrl;
        }

        var trimmedNew = string.IsNullOrWhiteSpace(dto.Content) ? string.Empty : dto.Content.Trim();
        if (trimmedNew.Length == 0 && !attachmentId.HasValue)
            return BadRequest(new { message = "Vui lòng nhập nội dung hoặc đính kèm một ảnh." });
        if (trimmedNew.Length > CommentContentMaxLength)
            return BadRequest(new { message = $"Bình luận tối đa {CommentContentMaxLength} ký tự." });

        var lastAt = await _db.MatchingPostComments.AsNoTracking()
            .Where(c => c.PostId == id && c.UserId == me && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.CreatedAt)
            .FirstOrDefaultAsync();
        if (lastAt.HasValue)
        {
            var lastUtc = AsUtcForCompare(lastAt.Value);
            if ((DateTime.UtcNow - lastUtc).TotalMilliseconds < 500)
                return StatusCode(429, new { message = "Bạn gửi quá nhanh. Vui lòng đợi một chút." });
        }

        var postRow = await _db.MatchingPosts.AsNoTracking()
            .FirstAsync(p => p.Id == id);

        var comment = new MatchingPostComment
        {
            Id = Guid.NewGuid(),
            PostId = id,
            ParentCommentId = parentId,
            UserId = me,
            Content = trimmedNew,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false,
            AttachmentFileId = attachmentId
        };
        _db.MatchingPostComments.Add(comment);
        await _db.SaveChangesAsync();

        var user = await _db.Users.AsNoTracking()
            .Include(u => u.AvatarFile)
            .FirstAsync(u => u.Id == me);

        var meta = new { postId = id, deepLink = $"/matching/{id}" };
        var hostId = postRow.CreatorUserId;

        if (!parentId.HasValue)
        {
            if (hostId.HasValue && hostId.Value != me)
            {
                await _notify.NotifyUserAsync(
                    hostId.Value,
                    NotificationTypes.MatchingNewComment,
                    "Bình luận mới trên bài tìm kèo",
                    $"{user.FullName} vừa bình luận trong nhóm của bạn.",
                    meta);
            }
        }
        else
        {
            if (hostId.HasValue && hostId.Value != me)
            {
                await _notify.NotifyUserAsync(
                    hostId.Value,
                    NotificationTypes.MatchingCommentReply,
                    "Có phản hồi mới",
                    $"{user.FullName} vừa trả lời một bình luận trên bài của bạn.",
                    meta);
            }

            if (parentAuthorId.HasValue && parentAuthorId.Value != me
                                        && parentAuthorId.Value != hostId)
            {
                await _notify.NotifyUserAsync(
                    parentAuthorId.Value,
                    NotificationTypes.MatchingCommentReply,
                    "Có người trả lời bạn",
                    $"{user.FullName} vừa trả lời bình luận của bạn.",
                    meta);
            }
        }

        return Ok(new
        {
            id = comment.Id,
            userId = me,
            fullName = user.FullName,
            avatarUrl = user.AvatarFile?.FileUrl,
            content = comment.Content,
            createdAt = AsUtcForJson(comment.CreatedAt),
            updatedAt = (DateTime?)null,
            isEdited = false,
            parentCommentId = comment.ParentCommentId,
            replyToFullName,
            replyCount = 0,
            attachmentFileId = comment.AttachmentFileId,
            imageUrl,
            message = "Bình luận đã được gửi."
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  PATCH /api/matching/posts/{postId}/comments/{commentId} — Tác giả sửa
    // ═══════════════════════════════════════════════════════════════
    [HttpPatch("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> PatchComment(Guid postId, Guid commentId, [FromBody] CommentDto dto)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == postId && m.UserId == me);
        if (!isMember)
            return Forbid();
        if (await IsPostInactiveAsync(postId))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể sửa bình luận." });

        var comment = await _db.MatchingPostComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.PostId == postId);
        if (comment == null)
            return NotFound(new { message = "Không tìm thấy bình luận." });

        if (comment.IsDeleted)
            return BadRequest(new { message = "Bình luận này đã được gỡ, không thể sửa." });

        if (comment.UserId != me)
            return Forbid();

        var trimmed = string.IsNullOrWhiteSpace(dto.Content) ? string.Empty : dto.Content.Trim();
        if (trimmed.Length == 0 && !comment.AttachmentFileId.HasValue)
            return BadRequest(new { message = "Vui lòng nhập nội dung hoặc giữ ảnh đính kèm." });
        if (trimmed.Length > CommentContentMaxLength)
            return BadRequest(new { message = $"Bình luận tối đa {CommentContentMaxLength} ký tự." });

        comment.Content = trimmed;
        comment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var projected = await _db.MatchingPostComments.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.ParentComment).ThenInclude(p => p!.User)
            .Include(c => c.AttachmentFile)
            .FirstAsync(c => c.Id == commentId);

        string? replyToName = null;
        if (projected.ParentCommentId.HasValue && projected.ParentComment != null && !projected.ParentComment.IsDeleted)
            replyToName = projected.ParentComment.User.FullName;

        var replyCount = projected.ParentCommentId == null
            ? await _db.MatchingPostComments.CountAsync(c => c.ParentCommentId == projected.Id && !c.IsDeleted)
            : 0;

        return Ok(new
        {
            id = projected.Id,
            userId = me,
            fullName = projected.User.FullName,
            avatarUrl = projected.User.AvatarFile?.FileUrl,
            content = projected.Content,
            createdAt = AsUtcForJson(projected.CreatedAt),
            updatedAt = AsUtcForJson(projected.UpdatedAt),
            isEdited = true,
            parentCommentId = projected.ParentCommentId,
            replyToFullName = replyToName,
            replyCount,
            attachmentFileId = projected.AttachmentFileId,
            imageUrl = projected.AttachmentFile?.FileUrl,
            message = "Đã cập nhật bình luận."
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  DELETE /api/matching/posts/{postId}/comments/{commentId} — Xóa mềm (chủ bài hoặc tác giả)
    // ═══════════════════════════════════════════════════════════════
    [HttpDelete("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> SoftDeleteComment(Guid postId, Guid commentId)
    {
        if (!TryGetCurrentUserId(out var me))
            return Unauthorized();

        var isMember = await _db.MatchingMembers.AsNoTracking()
            .AnyAsync(m => m.PostId == postId && m.UserId == me);
        if (!isMember)
            return Forbid();
        if (await IsPostInactiveAsync(postId))
            return BadRequest(new { message = "Bài đăng đã kết thúc — không thể gỡ bình luận." });

        var comment = await _db.MatchingPostComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.PostId == postId);
        if (comment == null)
            return NotFound(new { message = "Không tìm thấy bình luận." });

        if (comment.IsDeleted)
            return Ok(new { message = "Bình luận đã được gỡ trước đó." });

        var post = await _db.MatchingPosts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });

        var isHost = post.CreatorUserId == me;
        var isAuthor = comment.UserId == me;
        if (!isHost && !isAuthor)
            return Forbid();

        comment.IsDeleted = true;
        comment.DeletedAt = DateTime.UtcNow;
        comment.DeletedByUserId = me;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã gỡ bình luận." });
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

        return Ok(bookings.Select(b =>
        {
            var actualItemPriceMap = BuildActualItemPriceMap(b);
            var hasDiscount = (b.TotalAmount ?? 0m) > (b.FinalAmount ?? 0m);
            return new
            {
            id = b.Id,
            venueName = b.Venue?.Name,
            venueAddress = b.Venue?.Address,
            venueId = b.VenueId,
            totalAmount = b.TotalAmount,
            finalAmount = b.FinalAmount,
            hasDiscount,
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
                    price = actualItemPriceMap.GetValueOrDefault(i.Id, i.FinalPrice ?? 0m),
                    status = i.Status
                })
            };
        }));
    }

    // ═══════════════════════════════════════════
    //  Helper — map post to card DTO
    // ═══════════════════════════════════════════
    private static object MapPostCard(MatchingPost p, Guid me)
    {
        var filled = p.MatchingMembers.Count;
        var totalSlots = (p.RequiredPlayers ?? 0) + 1;
        var slotsLeft = Math.Max(totalSlots - filled, 0);
        var isHost = p.CreatorUserId == me;
        var isMember = p.MatchingMembers.Any(m => m.UserId == me);
        var isPending = p.MatchingJoinRequests.Any(r => r.UserId == me && r.Status == "PENDING");
        var canRequestJoin = !isHost && !isMember && !isPending && p.Status == "OPEN" && slotsLeft > 0
            && !IsInactiveStatus(p.Status);

        return new
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
            status = p.Status,
            membersCount = filled,
            createdAt = p.CreatedAt,
            isHost,
            isMember,
            isPending,
            canRequestJoin,
            host = new
            {
                id = p.CreatorUser?.Id,
                fullName = p.CreatorUser?.FullName,
                avatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                skillLevel = p.CreatorUser?.SkillLevel
            }
        };
    }
}

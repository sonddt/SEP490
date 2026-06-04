using Microsoft.Extensions.Logging;
using ShuttleUp.BLL.Constants;
using ShuttleUp.BLL.DTOs.Matching;
using ShuttleUp.BLL.Helpers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class MatchingService : IMatchingService
{
    private readonly IMatchingRepository _matchingRepo;
    private readonly IUserRepository _userRepo;
    private readonly IBookingRepository _bookingRepo;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostActivityService _activity;
    private readonly ILogger<MatchingService> _logger;

    public MatchingService(
        IMatchingRepository matchingRepo,
        IUserRepository userRepo,
        IBookingRepository bookingRepo,
        INotificationDispatchService notify,
        IMatchingPostActivityService activity,
        ILogger<MatchingService> logger)
    {
        _matchingRepo = matchingRepo;
        _userRepo = userRepo;
        _bookingRepo = bookingRepo;
        _notify = notify;
        _activity = activity;
        _logger = logger;
    }

    public async Task<MatchingPagedResultDto<MatchingPostCardDto>> GetOpenPostsAsync(
        string? skillLevel, string? province, DateOnly? playDate, 
        string? sort, string? q, int page, int pageSize, Guid? currentUserId,
        CancellationToken ct = default)
    {
        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(ct);

        var total = await _matchingRepo.CountPostsAsync(skillLevel, province, playDate, q);
        var items = await _matchingRepo.GetPostsPagedAsync(skillLevel, province, playDate, sort, q, (page - 1) * pageSize, pageSize);

        return new MatchingPagedResultDto<MatchingPostCardDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items.Select(p => MapPostCard(p, currentUserId ?? Guid.Empty))
        };
    }

    public async Task<IEnumerable<MatchingPostCardDto>> GetMyPostsAsync(Guid userId, CancellationToken ct = default)
    {
        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(ct);
        var posts = await _matchingRepo.GetMyPostsWithIncludesAsync(userId);
        return posts.Select(p => MapPostCard(p, userId));
    }

    public async Task<IEnumerable<MatchingPostCardDto>> GetJoinedPostsAsync(Guid userId, CancellationToken ct = default)
    {
        await _activity.ApplyExpiredOpenAndFullToInactiveAsync(ct);
        var posts = await _matchingRepo.GetJoinedPostsWithIncludesAsync(userId);
        return posts.Select(p => MapPostCard(p, userId));
    }

    public async Task<MatchingPostDetailDto?> GetPostDetailAsync(Guid postId, Guid? currentUserId, CancellationToken ct = default)
    {
        await _activity.EnsurePostInactiveIfElapsedAsync(postId, ct);
        var p = await _matchingRepo.GetPostDetailAsync(postId);
        if (p == null) return null;

        var me = currentUserId ?? Guid.Empty;
        var isHost = p.CreatorUserId == me;
        var isMember = p.MatchingMembers.Any(m => m.UserId == me);
        var myMemberId = p.MatchingMembers.FirstOrDefault(m => m.UserId == me)?.Id;
        var myJoinRequest = p.MatchingJoinRequests.FirstOrDefault(r => r.UserId == me && r.Status == "PENDING");

        Dictionary<Guid, decimal> actualMap = new();
        if (p.BookingId.HasValue)
        {
            var booking = await _bookingRepo.GetByIdWithItemsAndCourtsAsync(p.BookingId.Value);
            if (booking != null)
                actualMap = PriceDistributionHelper.BuildActualItemPriceMap(booking);
        }

        var actualItemsTotal = p.MatchingPostItems.Sum(i =>
            actualMap.GetValueOrDefault(i.BookingItemId, i.BookingItem?.FinalPrice ?? 0m));
        var originalItemsTotal = p.MatchingPostItems.Sum(i => i.BookingItem?.FinalPrice ?? 0m);
        var headCount = Math.Max((p.RequiredPlayers ?? 0) + 1, 1);
        var expenseSharing = p.ExpenseSharing == "female_free" ? "split_equal" : p.ExpenseSharing;
        decimal? originalPricePerSlot = expenseSharing switch
        {
            "host_pays" => 0,
            "negotiable" => null,
            _ => originalItemsTotal / headCount
        };

        var dto = new MatchingPostDetailDto
        {
            Id = p.Id,
            Title = p.Title,
            PlayDate = p.PlayDate,
            PlayStartTime = p.PlayStartTime?.ToString("HH:mm"),
            PlayEndTime = p.PlayEndTime?.ToString("HH:mm"),
            VenueName = p.Venue?.Name,
            VenueAddress = p.Venue?.Address,
            CourtName = p.CourtName,
            PricePerSlot = p.PricePerSlot,
            OriginalPricePerSlot = originalPricePerSlot,
            HasDiscount = originalItemsTotal > actualItemsTotal + 0.01m,
            RequiredPlayers = p.RequiredPlayers,
            SkillLevel = p.SkillLevel,
            GenderPref = p.GenderPref,
            ExpenseSharing = expenseSharing,
            PlayPurpose = p.PlayPurpose,
            Notes = p.Notes,
            Status = p.Status,
            CreatedAt = p.CreatedAt ?? DateTime.UtcNow,
            MembersCount = p.MatchingMembers.Count,
            IsHost = isHost,
            IsMember = isMember,
            MyMemberId = myMemberId,
            MyJoinRequestId = myJoinRequest?.Id,
            IsPending = myJoinRequest != null,
            Host = new MatchingHostDto
            {
                Id = p.CreatorUser?.Id,
                FullName = p.CreatorUser?.FullName,
                AvatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                SkillLevel = p.CreatorUser?.SkillLevel,
                Gender = p.CreatorUser?.Gender
            },
            Members = p.MatchingMembers.Select(m => new MatchingMemberDto
            {
                MemberId = m.Id,
                UserId = m.UserId,
                FullName = m.User?.FullName,
                AvatarUrl = m.User?.AvatarFile?.FileUrl,
                SkillLevel = m.User?.SkillLevel,
                Gender = m.User?.Gender,
                JoinedAt = m.JoinedAt
            }),
            BookingItems = p.MatchingPostItems.Select(i =>
            {
                var original = i.BookingItem?.FinalPrice ?? 0m;
                return new MatchingBookingItemDto
                {
                    BookingItemId = i.BookingItemId,
                    CourtName = i.BookingItem?.Court?.Name,
                    StartTime = AsUtcForJson(i.BookingItem?.StartTime),
                    EndTime = AsUtcForJson(i.BookingItem?.EndTime),
                    Price = actualMap.GetValueOrDefault(i.BookingItemId, original),
                    OriginalPrice = original
                };
            }),
            PendingRequests = isHost ? p.MatchingJoinRequests.Where(r => r.Status == "PENDING").Select(r => new MatchingJoinRequestDto
            {
                Id = r.Id,
                UserId = r.UserId,
                FullName = r.User?.FullName,
                AvatarUrl = r.User?.AvatarFile?.FileUrl,
                SkillLevel = r.User?.SkillLevel,
                Gender = r.User?.Gender,
                Message = r.Message,
                CreatedAt = r.CreatedAt ?? DateTime.UtcNow
            }) : null
        };

        return dto;
    }

    public async Task<Guid> CreatePostAsync(Guid userId, CreateMatchingPostDto dto, CancellationToken ct = default)
    {
        var booking = await _bookingRepo.GetByIdWithItemsAndCourtsAsync(dto.BookingId);
        if (booking == null || booking.UserId != userId)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt sân này.");

        var itemIds = dto.BookingItemIds ?? new List<Guid>();
        var items = booking.BookingItems?
            .Where(i => itemIds.Count == 0 || itemIds.Contains(i.Id))
            .OrderBy(i => i.StartTime)
            .ToList() ?? new List<BookingItem>();

        if (items.Count == 0)
            throw new InvalidOperationException("Vui lòng chọn ít nhất 1 ca chơi.");

        var actualItemPriceMap = PriceDistributionHelper.BuildActualItemPriceMap(booking);
        var actualSelectedTotal = items.Sum(i => actualItemPriceMap.GetValueOrDefault(i.Id, i.FinalPrice ?? 0m));

        var firstItem = items.First();
        var lastItem = items.Last();

        var postId = Guid.NewGuid();
        var post = new MatchingPost
        {
            Id = postId,
            CreatorUserId = userId,
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
            UpdatedAt = DateTime.UtcNow,
            MatchingPostItems = items.Select(item => new MatchingPostItem
            {
                Id = Guid.NewGuid(),
                PostId = postId,
                BookingItemId = item.Id
            }).ToList(),
            MatchingMembers = new List<MatchingMember>
            {
                new MatchingMember
                {
                    Id = Guid.NewGuid(),
                    PostId = postId,
                    UserId = userId,
                    JoinedAt = DateTime.UtcNow
                }
            }
        };

        await _matchingRepo.AddAsync(post);
        return post.Id;
    }

    public async Task UpdatePostAsync(Guid postId, Guid userId, UpdateMatchingPostDto dto, CancellationToken ct = default)
    {
        var post = await _matchingRepo.GetPostForUpdateAsync(postId);
        if (post == null || post.CreatorUserId != userId)
            throw new KeyNotFoundException("Không tìm thấy bài đăng.");

        if (post.Status == "Inactive" || post.Status == "INACTIVE")
            throw new InvalidOperationException("Bài đăng đã kết thúc — không thể chỉnh sửa.");
        if (post.Status != "OPEN")
            throw new InvalidOperationException("Chỉ có thể sửa bài đăng đang mở.");

        if (dto.RequiredPlayers.HasValue)
        {
            if (dto.RequiredPlayers.Value < 1)
                throw new InvalidOperationException("Số người cần tìm ít nhất là 1.");
            var maxMembers = dto.RequiredPlayers.Value + 1;
            if (post.MatchingMembers.Count > maxMembers)
                throw new InvalidOperationException("Số người cần tìm không thể nhỏ hơn số thành viên hiện có.");
            
            post.RequiredPlayers = dto.RequiredPlayers.Value;

            // Recalculate Price
            if (post.ExpenseSharing != "host_pays" && post.ExpenseSharing != "negotiable")
            {
                var booking = await _bookingRepo.GetByIdAsync(post.BookingId!.Value);
                var actualMap = booking != null ? PriceDistributionHelper.BuildActualItemPriceMap(booking) : null;
                var totalMoney = post.MatchingPostItems.Sum(i => 
                    actualMap?.GetValueOrDefault(i.BookingItemId, i.BookingItem?.FinalPrice ?? 0m) ?? (i.BookingItem?.FinalPrice ?? 0m));
                post.PricePerSlot = totalMoney / Math.Max((post.RequiredPlayers ?? 0) + 1, 1);
            }
        }

        if (dto.Title != null) post.Title = dto.Title;
        if (dto.SkillLevel != null) post.SkillLevel = dto.SkillLevel;
        if (dto.GenderPref != null) post.GenderPref = dto.GenderPref;
        if (dto.ExpenseSharing != null)
        {
            post.ExpenseSharing = dto.ExpenseSharing;
            var booking = await _bookingRepo.GetByIdAsync(post.BookingId!.Value);
            var actualMap = booking != null ? PriceDistributionHelper.BuildActualItemPriceMap(booking) : null;
            var totalMoney = post.MatchingPostItems.Sum(i => 
                actualMap?.GetValueOrDefault(i.BookingItemId, i.BookingItem?.FinalPrice ?? 0m) ?? (i.BookingItem?.FinalPrice ?? 0m));
            
            post.PricePerSlot = dto.ExpenseSharing switch
            {
                "host_pays" => 0,
                "negotiable" => null,
                _ => totalMoney / Math.Max((post.RequiredPlayers ?? 0) + 1, 1)
            };
        }
        if (dto.PlayPurpose != null) post.PlayPurpose = dto.PlayPurpose;
        if (dto.Notes != null) post.Notes = dto.Notes;
        post.UpdatedAt = DateTime.UtcNow;

        await _matchingRepo.UpdateAsync(post);
    }

    public async Task ClosePostAsync(Guid postId, Guid userId, CancellationToken ct = default)
    {
        var post = await _matchingRepo.GetPostForUpdateAsync(postId);
        if (post == null || post.CreatorUserId != userId)
            throw new KeyNotFoundException("Không tìm thấy bài đăng.");
        
        if (post.Status == "Inactive" || post.Status == "INACTIVE")
            throw new InvalidOperationException("Bài đăng đã kết thúc.");

        post.Status = "CLOSED";
        post.UpdatedAt = DateTime.UtcNow;

        var pending = await _matchingRepo.GetPendingRequestsByPostAsync(postId);
        foreach (var r in pending)
        {
            r.Status = "CANCELLED";
            r.UpdatedAt = DateTime.UtcNow;
            await _matchingRepo.UpdateJoinRequestAsync(r);
        }

        await _matchingRepo.UpdateAsync(post);

        // Notify
        var host = await _userRepo.GetByIdAsync(userId);
        foreach (var member in post.MatchingMembers.Where(m => m.UserId != userId))
        {
            if (member.UserId.HasValue)
            {
                await _notify.NotifyUserAsync(
                    member.UserId.Value,
                    NotificationTypes.MatchingPostClosed,
                    "Bài đăng đã đóng",
                    $"{host?.FullName} đã đóng bài đăng \"{post.Title}\".",
                    new { postId = postId, deepLink = $"/matching/{postId}" });
            }
        }
    }

    public async Task<string> ReopenPostAsync(Guid postId, Guid userId, CancellationToken ct = default)
    {
        var post = await _matchingRepo.GetPostForUpdateAsync(postId);
        if (post == null || post.CreatorUserId != userId)
            throw new KeyNotFoundException("Không tìm thấy bài đăng.");
        
        if (post.Status != "CLOSED")
            throw new InvalidOperationException("Chỉ có thể mở lại khi bài đăng đang ở trạng thái đã đóng.");

        var maxMembers = (post.RequiredPlayers ?? 0) + 1;
        var count = post.MatchingMembers.Count;
        post.Status = count >= maxMembers ? "FULL" : "OPEN";
        post.UpdatedAt = DateTime.UtcNow;
        await _matchingRepo.UpdateAsync(post);

        return post.Status;
    }

    public async Task<Guid> JoinPostAsync(Guid postId, Guid userId, string? message, CancellationToken ct = default)
    {
        var post = await _matchingRepo.GetPostDetailAsync(postId);
        if (post == null) throw new KeyNotFoundException("Không tìm thấy bài đăng.");
        
        if (post.Status == "Inactive" || post.Status == "INACTIVE")
            throw new InvalidOperationException("Bài đăng đã kết thúc.");
        if (post.Status != "OPEN")
            throw new InvalidOperationException("Bài đăng này không còn nhận thành viên mới.");
        if (post.CreatorUserId == userId)
            throw new InvalidOperationException("Bạn đã là chủ bài đăng.");

        if (post.MatchingMembers.Any(m => m.UserId == userId))
            throw new InvalidOperationException("Bạn đã là thành viên của nhóm này.");

        var existing = await _matchingRepo.GetPendingJoinRequestAsync(postId, userId);
        if (existing != null)
            throw new InvalidOperationException("Bạn đã gửi yêu cầu trước đó rồi.");

        if (post.MatchingMembers.Count >= (post.RequiredPlayers ?? 0) + 1)
            throw new InvalidOperationException("Nhóm đã đủ người rồi.");
        var request = new MatchingJoinRequest
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            UserId = userId,
            Message = message,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        await _matchingRepo.AddJoinRequestAsync(request);

        // Notify host
        var me = await _userRepo.GetByIdAsync(userId);
        if (post.CreatorUserId.HasValue)
        {
            await _notify.NotifyUserAsync(
                post.CreatorUserId.Value,
                NotificationTypes.MatchingJoinRequest,
                "Yêu cầu tham gia mới",
                $"{me?.FullName} muốn tham gia \"{post.Title}\".",
                new { postId = postId, requestId = request.Id, deepLink = $"/matching/{postId}" });
        }

        return request.Id;
    }

    public async Task CancelJoinRequestAsync(Guid postId, Guid userId, CancellationToken ct = default)
    {
        var request = await _matchingRepo.GetPendingJoinRequestAsync(postId, userId);
        if (request == null)
            throw new KeyNotFoundException("Không có yêu cầu đang chờ để hủy.");

        request.Status = "CANCELLED";
        request.UpdatedAt = DateTime.UtcNow;
        await _matchingRepo.UpdateJoinRequestAsync(request);
    }

    public async Task AcceptJoinRequestAsync(Guid requestId, Guid adminId, CancellationToken ct = default)
    {
        var request = await _matchingRepo.GetJoinRequestAsync(requestId);
        if (request == null) throw new KeyNotFoundException("Không tìm thấy yêu cầu.");

        if (request.Post?.CreatorUserId != adminId)
            throw new UnauthorizedAccessException("Bạn không có quyền duyệt yêu cầu này.");

        if (request.Post.Status == "Inactive" || request.Post.Status == "INACTIVE")
            throw new InvalidOperationException("Bài đăng đã kết thúc.");

        if (request.Status != "PENDING")
            throw new InvalidOperationException("Yêu cầu này đã được xử lý.");

        var maxMembers = (request.Post.RequiredPlayers ?? 0) + 1;
        var currentMembers = await _matchingRepo.CountMembersAsync(request.PostId!.Value);
        if (currentMembers >= maxMembers)
            throw new InvalidOperationException("Nhóm đã đủ người.");

        var alreadyMember = await _matchingRepo.GetMemberByPostAndUserAsync(request.PostId.Value, request.UserId!.Value);
        if (alreadyMember != null)
            throw new InvalidOperationException("Người chơi này đã là thành viên.");

        request.Status = "ACCEPTED";
        request.UpdatedAt = DateTime.UtcNow;
        await _matchingRepo.UpdateJoinRequestAsync(request);

        await _matchingRepo.AddMemberAsync(new MatchingMember
        {
            Id = Guid.NewGuid(),
            PostId = request.PostId,
            UserId = request.UserId,
            JoinedAt = DateTime.UtcNow
        });

        // Auto-close if full
        var newCount = await _matchingRepo.CountMembersAsync(request.PostId.Value);
        if (newCount >= maxMembers)
        {
            var post = request.Post;
            post.Status = "FULL";
            post.UpdatedAt = DateTime.UtcNow;
            await _matchingRepo.UpdateAsync(post);

            var remaining = await _matchingRepo.GetPendingRequestsByPostAsync(request.PostId.Value);
            foreach (var r in remaining)
            {
                r.Status = "CANCELLED";
                r.UpdatedAt = DateTime.UtcNow;
                await _matchingRepo.UpdateJoinRequestAsync(r);
            }
        }

        // Notify
        var host = await _userRepo.GetByIdAsync(adminId);
        await _notify.NotifyUserAsync(
            request.UserId.Value,
            NotificationTypes.MatchingJoinAccepted,
            "Đã được chấp nhận! 🎉",
            $"{host?.FullName} đã chấp nhận bạn vào nhóm \"{request.Post.Title}\".",
            new { postId = request.PostId, deepLink = $"/matching/{request.PostId}" });
    }

    public async Task RejectJoinRequestAsync(Guid requestId, Guid adminId, string? reason, CancellationToken ct = default)
    {
        var request = await _matchingRepo.GetJoinRequestAsync(requestId);
        if (request == null) throw new KeyNotFoundException("Không tìm thấy yêu cầu.");

        if (request.Post?.CreatorUserId != adminId)
            throw new UnauthorizedAccessException("Bạn không có quyền xử lý yêu cầu này.");

        if (request.Status != "PENDING")
            throw new InvalidOperationException("Yêu cầu này đã được xử lý.");

        request.Status = "REJECTED";
        request.RejectReason = reason;
        request.UpdatedAt = DateTime.UtcNow;
        await _matchingRepo.UpdateJoinRequestAsync(request);

        // Notify
        var host = await _userRepo.GetByIdAsync(adminId);
        await _notify.NotifyUserAsync(
            request.UserId!.Value,
            NotificationTypes.MatchingJoinRejected,
            "Yêu cầu chưa được duyệt",
            $"Yêu cầu tham gia \"{request.Post.Title}\" chưa được duyệt." +
            (string.IsNullOrWhiteSpace(reason) ? "" : $" Lý do: {reason}"),
            new { postId = request.PostId, deepLink = $"/matching/{request.PostId}" });
    }

    public async Task<string> RemoveMemberAsync(Guid memberId, Guid currentUserId, CancellationToken ct = default)
    {
        var member = await _matchingRepo.GetMemberAsync(memberId);
        if (member == null) throw new KeyNotFoundException("Không tìm thấy thành viên.");

        var isHost = member.Post?.CreatorUserId == currentUserId;
        var isSelf = member.UserId == currentUserId;

        if (!isHost && !isSelf)
            throw new UnauthorizedAccessException("Bạn không có quyền thực hiện hành động này.");

        if (isHost && isSelf)
            throw new InvalidOperationException("Chủ bài đăng không thể rời nhóm. Hãy đóng bài đăng.");

        var postId = member.PostId!.Value;
        var post = member.Post!;
        var memberUserId = member.UserId!.Value;

        await _matchingRepo.RemoveMemberAsync(member);

        if (post.Status == "FULL")
        {
            post.Status = "OPEN";
            post.UpdatedAt = DateTime.UtcNow;
            await _matchingRepo.UpdateAsync(post);
        }

        await _activity.EnsurePostInactiveIfElapsedAsync(postId, ct);

        // Notify
        if (isHost && !isSelf)
        {
            var host = await _userRepo.GetByIdAsync(currentUserId);
            await _notify.NotifyUserAsync(
                memberUserId,
                NotificationTypes.MatchingMemberKicked,
                "Bạn đã rời nhóm",
                $"Bạn đã bị xóa khỏi nhóm \"{post.Title}\" bởi {host?.FullName}.",
                new { postId = postId, deepLink = "/matching" });
        }

        return isSelf ? "Bạn đã rời khỏi nhóm." : "Đã xóa thành viên khỏi nhóm.";
    }

    public async Task<IEnumerable<UpcomingBookingDto>> GetUpcomingBookingsAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var bookings = await _bookingRepo.GetMyBookingsRawAsync(userId, ct);

        var filtered = bookings
            .Where(b => b.Status == "CONFIRMED"
                && b.BookingItems.Any(i => i.StartTime > now))
            .OrderByDescending(b => b.CreatedAt)
            .Take(20);

        return filtered.Select(b =>
        {
            var actualMap = PriceDistributionHelper.BuildActualItemPriceMap(b);
            return new UpcomingBookingDto
            {
                Id = b.Id,
                VenueName = b.Venue?.Name,
                VenueAddress = b.Venue?.Address,
                VenueId = b.VenueId,
                TotalAmount = b.TotalAmount,
                FinalAmount = b.FinalAmount,
                HasDiscount = (b.TotalAmount ?? 0m) > (b.FinalAmount ?? 0m),
                CreatedAt = (DateTime)(b.CreatedAt ?? DateTime.UtcNow),
                Items = b.BookingItems
                    .Where(i => i.StartTime > now)
                    .OrderBy(i => i.StartTime)
                    .Select(i =>
                    {
                        var original = i.FinalPrice ?? 0m;
                        return new MatchingBookingItemDto
                        {
                            BookingItemId = i.Id,
                            CourtName = i.Court?.Name,
                            StartTime = i.StartTime,
                            EndTime = i.EndTime,
                            Price = actualMap.GetValueOrDefault(i.Id, original),
                            OriginalPrice = original
                        };
                    })
            };
        });
    }

    // ── Helpers ──

    private MatchingPostCardDto MapPostCard(MatchingPost p, Guid me)
    {
        var filled = p.MatchingMembers.Count;
        var totalSlots = (p.RequiredPlayers ?? 0) + 1;
        var slotsLeft = Math.Max(totalSlots - filled, 0);
        var isHost = p.CreatorUserId == me;
        var isMember = p.MatchingMembers.Any(m => m.UserId == me);
        var isPending = p.MatchingJoinRequests.Any(r => r.UserId == me && r.Status == "PENDING");
        var canRequestJoin = !isHost && !isMember && !isPending && p.Status == "OPEN" && slotsLeft > 0
            && !IsInactiveStatus(p.Status);

        // Calculate original price for strikethrough display
        var totalOriginal = p.MatchingPostItems.Sum(i => i.BookingItem?.FinalPrice ?? 0m);
        var headCount = Math.Max(totalSlots, 1);
        var expenseSharing = p.ExpenseSharing == "female_free" ? "split_equal" : p.ExpenseSharing;
        decimal? originalPricePerSlot = expenseSharing switch
        {
            "host_pays" => 0,
            "negotiable" => null,
            _ => totalOriginal / headCount
        };

        return new MatchingPostCardDto
        {
            Id = p.Id,
            Title = p.Title,
            PlayDate = p.PlayDate,
            PlayStartTime = p.PlayStartTime?.ToString("HH:mm"),
            PlayEndTime = p.PlayEndTime?.ToString("HH:mm"),
            VenueName = p.Venue?.Name,
            VenueAddress = p.Venue?.Address,
            CourtName = p.CourtName,
            PricePerSlot = p.PricePerSlot,
            OriginalPricePerSlot = originalPricePerSlot,
            RequiredPlayers = p.RequiredPlayers,
            SkillLevel = p.SkillLevel,
            GenderPref = p.GenderPref,
            ExpenseSharing = expenseSharing,
            PlayPurpose = p.PlayPurpose,
            Status = p.Status,
            MembersCount = filled,
            CreatedAt = p.CreatedAt ?? DateTime.UtcNow,
            IsHost = isHost,
            IsMember = isMember,
            IsPending = isPending,
            CanRequestJoin = canRequestJoin,
            Host = new MatchingHostDto
            {
                Id = p.CreatorUser?.Id,
                FullName = p.CreatorUser?.FullName,
                AvatarUrl = p.CreatorUser?.AvatarFile?.FileUrl,
                SkillLevel = p.CreatorUser?.SkillLevel
            }
        };
    }

    private static bool IsInactiveStatus(string? status) =>
        string.Equals(status, "Inactive", StringComparison.OrdinalIgnoreCase);

    private static DateTime? AsUtcForJson(DateTime? dt) =>
        dt.HasValue
            ? (dt.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc)
                : dt.Value.ToUniversalTime())
            : null;

}

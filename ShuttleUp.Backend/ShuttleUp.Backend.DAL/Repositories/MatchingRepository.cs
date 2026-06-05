using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Helpers;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class MatchingRepository : Repository<MatchingPost>, IMatchingRepository
{
    public MatchingRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    private static IQueryable<MatchingPost> BuildOpenPostsQuery(IQueryable<MatchingPost> query, DateTime localTime)
    {
        return query
            .Where(p => p.Status == "OPEN" || p.Status == "FULL")
            .Where(p => p.MatchingPostItems.Any(i =>
                i.BookingItem != null
                && i.BookingItem.StartTime.HasValue
                && i.BookingItem.StartTime.Value > localTime));
    }

    private static bool MatchesProvince(MatchingPost post, string province)
    {
        return SearchNormalize.FoldedContains(post.Venue?.Address, province)
            || SearchNormalize.FoldedContains(post.Venue?.Name, province);
    }

    private static bool MatchesSearch(MatchingPost post, string search)
    {
        var foldQ = SearchNormalize.Fold(search);
        if (string.IsNullOrEmpty(foldQ)) return true;
        return SearchNormalize.FoldedContains(post.Title, search)
            || SearchNormalize.FoldedContains(post.Venue?.Name, search)
            || SearchNormalize.FoldedContains(post.CourtName, search)
            || SearchNormalize.FoldedContains(post.Venue?.Address, search)
            || SearchNormalize.FoldedContains(post.CreatorUser?.FullName, search);
    }

    private static IEnumerable<MatchingPost> ApplyInMemoryFilters(
        IEnumerable<MatchingPost> posts, string? province, string? search)
    {
        var result = posts;
        if (!string.IsNullOrWhiteSpace(province))
            result = result.Where(p => MatchesProvince(p, province));
        if (!string.IsNullOrWhiteSpace(search))
            result = result.Where(p => MatchesSearch(p, search));
        return result;
    }

    private static IQueryable<MatchingPost> ApplySkillFilter(IQueryable<MatchingPost> query, string? skillLevel)
    {
        if (string.IsNullOrWhiteSpace(skillLevel)) return query;
        var aliases = SkillLevelHelper.GetFilterAliases(skillLevel).ToList();
        return query.Where(p => p.SkillLevel != null && aliases.Contains(p.SkillLevel));
    }

    private static IQueryable<MatchingPost> ApplySort(IQueryable<MatchingPost> query, string? sort)
    {
        return sort switch
        {
            "price_asc" => query.OrderBy(p => p.PricePerSlot.HasValue 
                ? p.PricePerSlot.Value * ((p.RequiredPlayers ?? 0) + 1)
                : p.MatchingPostItems.Sum(i => i.BookingItem != null && i.BookingItem.FinalPrice.HasValue ? i.BookingItem.FinalPrice.Value : 0m)),
            "price_desc" => query.OrderByDescending(p => p.PricePerSlot.HasValue 
                ? p.PricePerSlot.Value * ((p.RequiredPlayers ?? 0) + 1)
                : p.MatchingPostItems.Sum(i => i.BookingItem != null && i.BookingItem.FinalPrice.HasValue ? i.BookingItem.FinalPrice.Value : 0m)),
            "soonest" => query.OrderBy(p => p.PlayDate).ThenBy(p => p.PlayStartTime),
            "oldest" => query.OrderBy(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };
    }

    public async Task<IEnumerable<MatchingPost>> GetPostsPagedAsync(string? skillLevel, string? province, DateOnly? playDate, string? sort, string? search, string? status, int skip, int take)
    {
        var localTime = DateTime.Now;
        IQueryable<MatchingPost> query = _dbSet.AsNoTracking();
        query = BuildOpenPostsQuery(query, localTime);
        if (status == "OPEN") query = query.Where(p => p.Status == "OPEN");
        if (status == "FULL") query = query.Where(p => p.Status == "FULL");
        query = ApplySkillFilter(query, skillLevel);

        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);

        query = ApplySort(query, sort);

        var needsInMemoryFilter = !string.IsNullOrWhiteSpace(province) || !string.IsNullOrWhiteSpace(search);
        if (!needsInMemoryFilter)
        {
            return await query
                .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
                .Include(p => p.Venue).ThenInclude(v => v!.Files)
                .Include(p => p.MatchingMembers)
                .Include(p => p.MatchingJoinRequests)
                .Include(p => p.MatchingPostItems).ThenInclude(i => i.BookingItem)
                .Skip(skip).Take(take).ToListAsync();
        }

        var all = await query
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue).ThenInclude(v => v!.Files)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Include(p => p.MatchingPostItems).ThenInclude(i => i.BookingItem)
            .ToListAsync();
        return ApplyInMemoryFilters(all, province, search).Skip(skip).Take(take).ToList();
    }

    public async Task<int> CountPostsAsync(string? skillLevel, string? province, DateOnly? playDate, string? search, string? status)
    {
        var localTime = DateTime.Now;
        IQueryable<MatchingPost> query = _dbSet.AsNoTracking();
        query = BuildOpenPostsQuery(query, localTime);
        if (status == "OPEN") query = query.Where(p => p.Status == "OPEN");
        if (status == "FULL") query = query.Where(p => p.Status == "FULL");
        query = ApplySkillFilter(query, skillLevel);

        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);

        var needsInMemoryFilter = !string.IsNullOrWhiteSpace(province) || !string.IsNullOrWhiteSpace(search);
        if (!needsInMemoryFilter)
        {
            return await query.CountAsync();
        }

        var all = await query
            .Include(p => p.Venue).ThenInclude(v => v!.Files)
            .Include(p => p.CreatorUser)
            .ToListAsync();
        return ApplyInMemoryFilters(all, province, search).Count();
    }

    public async Task<MatchingPost?> GetPostDetailAsync(Guid postId)
    {
        return await _dbSet.AsNoTracking()
            .Include(x => x.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.Venue).ThenInclude(v => v!.Files)
            .Include(x => x.MatchingMembers).ThenInclude(m => m.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingJoinRequests) // We might filter PENDING in service if needed, or include all
                .ThenInclude(r => r.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingPostItems).ThenInclude(i => i.BookingItem).ThenInclude(b => b.Court)
            .FirstOrDefaultAsync(x => x.Id == postId);
    }

    public async Task<MatchingPost?> GetPostForUpdateAsync(Guid postId)
    {
        return await _dbSet
            .Include(x => x.MatchingPostItems).ThenInclude(i => i.BookingItem)
            .Include(x => x.MatchingMembers)
            .FirstOrDefaultAsync(x => x.Id == postId);
    }

    public async Task<IEnumerable<MatchingPost>> GetMyPostsWithIncludesAsync(Guid userId)
    {
        return await _dbSet.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue).ThenInclude(v => v!.Files)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Include(p => p.MatchingPostItems).ThenInclude(i => i.BookingItem)
            .Where(p => p.CreatorUserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<MatchingPost>> GetJoinedPostsWithIncludesAsync(Guid userId)
    {
        return await _dbSet.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue).ThenInclude(v => v!.Files)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Include(p => p.MatchingPostItems).ThenInclude(i => i.BookingItem)
            .Where(p => p.CreatorUserId != userId && p.MatchingMembers.Any(m => m.UserId == userId))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<MatchingJoinRequest?> GetJoinRequestAsync(Guid requestId)
    {
        return await _context.MatchingJoinRequests
            .Include(r => r.Post)
            .FirstOrDefaultAsync(r => r.Id == requestId);
    }

    public async Task AddJoinRequestAsync(MatchingJoinRequest request)
    {
        _context.MatchingJoinRequests.Add(request);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateJoinRequestAsync(MatchingJoinRequest request)
    {
        _context.MatchingJoinRequests.Update(request);
        await _context.SaveChangesAsync();
    }

    public async Task<MatchingJoinRequest?> GetPendingJoinRequestAsync(Guid postId, Guid userId)
    {
        return await _context.MatchingJoinRequests.AsNoTracking()
            .FirstOrDefaultAsync(r => r.PostId == postId && r.UserId == userId && r.Status == "PENDING");
    }

    public async Task<IEnumerable<MatchingJoinRequest>> GetPendingRequestsByPostAsync(Guid postId)
    {
        return await _context.MatchingJoinRequests
            .Where(r => r.PostId == postId && r.Status == "PENDING")
            .ToListAsync();
    }

    public async Task AddMemberAsync(MatchingMember member)
    {
        _context.MatchingMembers.Add(member);
        await _context.SaveChangesAsync();
    }

    public async Task<MatchingMember?> GetMemberAsync(Guid memberId)
    {
        return await _context.MatchingMembers
            .Include(m => m.Post)
            .FirstOrDefaultAsync(m => m.Id == memberId);
    }

    public async Task<MatchingMember?> GetMemberByPostAndUserAsync(Guid postId, Guid userId)
    {
        return await _context.MatchingMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.PostId == postId && m.UserId == userId);
    }

    public async Task RemoveMemberAsync(MatchingMember member)
    {
        _context.MatchingMembers.Remove(member);
        await _context.SaveChangesAsync();
    }

    public async Task<int> CountMembersAsync(Guid postId)
    {
        return await _context.MatchingMembers.CountAsync(m => m.PostId == postId);
    }

    public async Task<IEnumerable<MatchingPost>> GetPostsByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(p => p.MatchingMembers)
            .Where(p => p.BookingId == bookingId && p.Status != "CANCELLED")
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<MatchingPost>> GetExpiredPostsAsync(DateTime localTime, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(p => p.Status == "OPEN" || p.Status == "FULL")
            .Where(p => !_context.MatchingPostItems.Any(mpi =>
                mpi.PostId == p.Id
                && mpi.BookingItem != null
                && mpi.BookingItem.StartTime != null
                && mpi.BookingItem.StartTime > localTime))
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<MatchingJoinRequest>> GetPendingRequestsForPostsAsync(IEnumerable<Guid> postIds, CancellationToken cancellationToken = default)
    {
        return await _context.MatchingJoinRequests
            .Where(r => r.PostId != null && postIds.Contains(r.PostId.Value) && r.Status == "PENDING")
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> HasFutureBookingItemsAsync(Guid postId, DateTime localTime, CancellationToken cancellationToken = default)
    {
        return await _context.MatchingPostItems
            .AnyAsync(mpi =>
                mpi.PostId == postId
                && mpi.BookingItem != null
                && mpi.BookingItem.StartTime != null
                && mpi.BookingItem.StartTime > localTime,
                cancellationToken);
    }
}

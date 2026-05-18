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

    public async Task<IEnumerable<MatchingPost>> GetPostsPagedAsync(string? skillLevel, string? province, DateOnly? playDate, string? sort, string? search, int skip, int take)
    {
        var localTime = DateTime.Now;
        var query = _dbSet.AsNoTracking()
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

        if (!string.IsNullOrWhiteSpace(skillLevel))
            query = query.Where(p => p.SkillLevel == skillLevel);
        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);
        if (!string.IsNullOrWhiteSpace(province))
            query = query.Where(p => p.Venue != null && p.Venue.Address.Contains(province));

        query = sort switch
        {
            "price_asc" => query.OrderBy(p => p.PricePerSlot),
            "price_desc" => query.OrderByDescending(p => p.PricePerSlot),
            "soonest" => query.OrderBy(p => p.PlayDate).ThenBy(p => p.PlayStartTime),
            "oldest" => query.OrderBy(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        if (string.IsNullOrWhiteSpace(search))
        {
            return await query.Skip(skip).Take(take).ToListAsync();
        }

        var foldQ = SearchNormalize.Fold(search);
        var all = await query.ToListAsync();
        return all.Where(p =>
            SearchNormalize.FoldedContains(p.Title, foldQ)
            || SearchNormalize.FoldedContains(p.Venue?.Name, foldQ)
            || SearchNormalize.FoldedContains(p.CourtName, foldQ)
            || SearchNormalize.FoldedContains(p.Venue?.Address, foldQ)
            || SearchNormalize.FoldedContains(p.CreatorUser?.FullName, foldQ))
            .Skip(skip).Take(take).ToList();
    }

    public async Task<int> CountPostsAsync(string? skillLevel, string? province, DateOnly? playDate, string? search)
    {
        var localTime = DateTime.Now;
        var query = _dbSet.AsNoTracking()
            .Where(p => p.Status == "OPEN" || p.Status == "FULL")
            .Where(p => p.MatchingPostItems.Any(i =>
                i.BookingItem != null
                && i.BookingItem.StartTime.HasValue
                && i.BookingItem.StartTime.Value > localTime));

        if (!string.IsNullOrWhiteSpace(skillLevel))
            query = query.Where(p => p.SkillLevel == skillLevel);
        if (playDate.HasValue)
            query = query.Where(p => p.PlayDate == playDate);
        if (!string.IsNullOrWhiteSpace(province))
            query = query.Where(p => p.Venue != null && p.Venue.Address.Contains(province));

        if (string.IsNullOrWhiteSpace(search))
        {
            return await query.CountAsync();
        }

        var foldQ = SearchNormalize.Fold(search);
        var all = await query.ToListAsync();
        return all.Count(p =>
            SearchNormalize.FoldedContains(p.Title, foldQ)
            || SearchNormalize.FoldedContains(p.Venue?.Name, foldQ)
            || SearchNormalize.FoldedContains(p.CourtName, foldQ)
            || SearchNormalize.FoldedContains(p.Venue?.Address, foldQ)
            || SearchNormalize.FoldedContains(p.CreatorUser?.FullName, foldQ));
    }

    public async Task<MatchingPost?> GetPostDetailAsync(Guid postId)
    {
        return await _dbSet.AsNoTracking()
            .Include(x => x.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.Venue)
            .Include(x => x.MatchingMembers).ThenInclude(m => m.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingJoinRequests) // We might filter PENDING in service if needed, or include all
                .ThenInclude(r => r.User).ThenInclude(u => u!.AvatarFile)
            .Include(x => x.MatchingPostItems).ThenInclude(i => i.BookingItem).ThenInclude(b => b.Court)
            .FirstOrDefaultAsync(x => x.Id == postId);
    }

    public async Task<IEnumerable<MatchingPost>> GetMyPostsWithIncludesAsync(Guid userId)
    {
        return await _dbSet.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
            .Where(p => p.CreatorUserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<MatchingPost>> GetJoinedPostsWithIncludesAsync(Guid userId)
    {
        return await _dbSet.AsNoTracking()
            .Include(p => p.CreatorUser).ThenInclude(u => u!.AvatarFile)
            .Include(p => p.Venue)
            .Include(p => p.MatchingMembers)
            .Include(p => p.MatchingJoinRequests)
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
}

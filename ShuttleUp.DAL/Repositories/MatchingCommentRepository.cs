using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class MatchingCommentRepository : Repository<MatchingPostComment>, IMatchingCommentRepository
{
    public MatchingCommentRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<MatchingPostComment>> GetRootCommentsPagedAsync(Guid postId, string sort, int skip, int take)
    {
        var query = _dbSet.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.AttachmentFile)
            .Where(c => c.PostId == postId && !c.IsDeleted && c.ParentCommentId == null);

        query = sort switch
        {
            "oldest" => query.OrderBy(c => c.CreatedAt),
            "popular" => query.OrderByDescending(c => _context.MatchingPostComments.Count(r => r.ParentCommentId == c.Id && !r.IsDeleted))
                              .ThenByDescending(c => c.CreatedAt),
            _ => query.OrderByDescending(c => c.CreatedAt)
        };

        return await query.Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountRootCommentsAsync(Guid postId)
    {
        return await _dbSet.CountAsync(c => c.PostId == postId && !c.IsDeleted && c.ParentCommentId == null);
    }

    public async Task<IEnumerable<MatchingPostComment>> GetRepliesPagedAsync(Guid postId, Guid rootId, int skip, int take)
    {
        return await _dbSet.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.ParentComment).ThenInclude(p => p!.User)
            .Include(c => c.AttachmentFile)
            .Where(c => c.PostId == postId && !c.IsDeleted && c.ParentCommentId == rootId)
            .OrderBy(c => c.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();
    }

    public async Task<int> CountRepliesAsync(Guid postId, Guid rootId)
    {
        return await _dbSet.CountAsync(c => c.PostId == postId && !c.IsDeleted && c.ParentCommentId == rootId);
    }

    public async Task<Dictionary<Guid, int>> GetReplyCountsAsync(Guid postId)
    {
        return await _dbSet.AsNoTracking()
            .Where(r => r.PostId == postId && !r.IsDeleted && r.ParentCommentId != null)
            .GroupBy(r => r.ParentCommentId!)
            .Select(g => new { ParentId = g.Key!.Value, Cnt = g.Count() })
            .ToDictionaryAsync(x => x.ParentId, x => x.Cnt);
    }

    public async Task<MatchingPostComment?> GetWithIncludesAsync(Guid commentId)
    {
        return await _dbSet.AsNoTracking()
            .Include(c => c.User).ThenInclude(u => u!.AvatarFile)
            .Include(c => c.ParentComment).ThenInclude(p => p!.User)
            .Include(c => c.AttachmentFile)
            .FirstOrDefaultAsync(c => c.Id == commentId);
    }

    public async Task<DateTime?> GetLastCommentTimeAsync(Guid userId, Guid postId)
    {
        return await _dbSet.AsNoTracking()
            .Where(c => c.PostId == postId && c.UserId == userId && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.CreatedAt)
            .FirstOrDefaultAsync();
    }
}

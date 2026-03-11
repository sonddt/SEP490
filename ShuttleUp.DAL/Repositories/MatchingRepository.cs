using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class MatchingRepository : Repository<MatchingPost>, IMatchingRepository
{
    public MatchingRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<MatchingPost>> GetOpenPostsAsync()
    {
        return await _dbSet.Where(m => m.Status == "OPEN").ToListAsync();
    }

    public async Task<IEnumerable<MatchingPost>> GetByCreatorAsync(Guid creatorUserId)
    {
        return await _dbSet.Where(m => m.CreatorUserId == creatorUserId).ToListAsync();
    }

    public async Task<IEnumerable<MatchingJoinRequest>> GetJoinRequestsByPostAsync(Guid postId)
    {
        return await _context.MatchingJoinRequests.Where(r => r.PostId == postId).ToListAsync();
    }
}

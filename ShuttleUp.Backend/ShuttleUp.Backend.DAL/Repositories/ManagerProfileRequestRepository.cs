using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class ManagerProfileRequestRepository : IManagerProfileRequestRepository
{
    private readonly ShuttleUpDbContext _context;

    public ManagerProfileRequestRepository(ShuttleUpDbContext context) { _context = context; }

    public async Task<ManagerProfileRequest?> GetPendingByUserIdAsync(Guid userId)
        => await _context.ManagerProfileRequests.FirstOrDefaultAsync(r => r.UserId == userId && r.Status == "PENDING");

    public async Task<ManagerProfileRequest?> GetLatestByUserIdAsync(Guid userId)
        => await _context.ManagerProfileRequests.OrderByDescending(r => r.RequestedAt).FirstOrDefaultAsync(r => r.UserId == userId);

    public async Task AddAsync(ManagerProfileRequest request)
    {
        await _context.ManagerProfileRequests.AddAsync(request);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ManagerProfileRequest request)
    {
        _context.ManagerProfileRequests.Update(request);
        await _context.SaveChangesAsync();
    }

    // ── Expanded ──
    public async Task<ManagerProfileRequest?> GetWithUserAndRolesAsync(Guid requestId)
        => await _context.ManagerProfileRequests.Include(r => r.User).ThenInclude(u => u.Roles).FirstOrDefaultAsync(r => r.Id == requestId);

    public async Task<List<ManagerProfileRequest>> GetRequestsPagedAsync(string? search, string? status, int skip, int take)
    {
        var q = BuildQuery(search, status);
        return await q.OrderBy(r => r.Status == "PENDING" ? 0 : 1).ThenByDescending(r => r.RequestedAt).Skip(skip).Take(take).ToListAsync();
    }

    public async Task<int> CountRequestsAsync(string? search, string? status)
        => await BuildQuery(search, status).CountAsync();

    public async Task<int> CountPendingAsync()
        => await _context.ManagerProfileRequests.CountAsync(r => r.Status == "PENDING");

    public async Task<List<ManagerProfileRequest>> GetRecentPendingAsync(int count)
        => await _context.ManagerProfileRequests.Where(r => r.Status == "PENDING").Include(r => r.User)
            .OrderByDescending(r => r.RequestedAt).Take(count).ToListAsync();

    private IQueryable<ManagerProfileRequest> BuildQuery(string? search, string? status)
    {
        var q = _context.ManagerProfileRequests.Include(r => r.User).Include(r => r.AdminUser).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(r => r.Status == status.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            q = q.Where(r => (r.User != null && r.User.FullName.Contains(kw)) || (r.User != null && r.User.Email.Contains(kw)) || (r.TaxCode != null && r.TaxCode.Contains(kw)) || (r.Address != null && r.Address.Contains(kw)));
        }
        return q;
    }
}

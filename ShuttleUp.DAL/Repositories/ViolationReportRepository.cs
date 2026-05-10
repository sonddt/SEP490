using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class ViolationReportRepository : Repository<ViolationReport>, IViolationReportRepository
{
    public ViolationReportRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<ViolationReport?> GetWithReporterAsync(Guid id)
        => await _dbSet.Include(r => r.ReporterUser).FirstOrDefaultAsync(r => r.Id == id);

    public async Task<ViolationReport?> GetDetailAsync(Guid id)
        => await _dbSet.AsNoTracking().Include(r => r.ReporterUser).Include(r => r.AdminUser).Include(r => r.Files).FirstOrDefaultAsync(r => r.Id == id);

    public async Task<(int total, List<ViolationReport> items)> GetReportsPagedAsync(string? targetType, string? status, string? search, bool overdueRefund, int skip, int take)
    {
        var now = DateTime.UtcNow;
        var query = _dbSet.AsNoTracking().Include(r => r.ReporterUser).Include(r => r.AdminUser).Include(r => r.Files).AsQueryable();

        if (!string.IsNullOrWhiteSpace(targetType) && targetType.Trim().ToUpperInvariant() != "ALL")
            query = query.Where(r => r.TargetType == targetType.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(status) && status.Trim().ToUpperInvariant() != "ALL")
            query = query.Where(r => r.Status == status.Trim().ToUpperInvariant());
        if (overdueRefund)
            query = query.Where(r => r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(r => (r.Reason != null && r.Reason.Contains(kw)) || (r.Description != null && r.Description.Contains(kw)) || (r.ReporterUser != null && r.ReporterUser.FullName.Contains(kw)));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(r => r.Status == "PENDING" ? 0 : r.Status == "REVIEWING" ? 1 : r.Status == "REFUND_PENDING" ? 2 : r.Status == "RESOLVED" ? 3 : 4)
            .ThenBy(r => r.Status == "REFUND_PENDING" && r.RefundDeadlineAt != null && r.RefundDeadlineAt < now ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt)
            .Skip(skip).Take(take).ToListAsync();

        return (total, items);
    }

    public async Task AddLogAsync(ViolationReportLog log)
    {
        _context.ViolationReportLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    public async Task<List<ViolationReportLog>> GetLogsAsync(Guid reportId)
        => await _context.ViolationReportLogs.AsNoTracking().Include(l => l.AdminUser)
            .Where(l => l.ReportId == reportId).OrderByDescending(l => l.CreatedAt).ToListAsync();

    public async Task<string?> ResolveTargetNameAsync(string? targetType, Guid? targetId)
    {
        if (targetId == null || targetId == Guid.Empty || string.IsNullOrWhiteSpace(targetType)) return null;
        return targetType.Trim().ToUpperInvariant() switch
        {
            "USER" => await _context.Users.AsNoTracking().Where(u => u.Id == targetId).Select(u => u.FullName).FirstOrDefaultAsync(),
            "VENUE" => await _context.Venues.AsNoTracking().Where(v => v.Id == targetId).Select(v => v.Name).FirstOrDefaultAsync(),
            "MATCHING_POST" => await _context.MatchingPosts.AsNoTracking().Where(p => p.Id == targetId).Select(p => p.Title).FirstOrDefaultAsync(),
            "BOOKING" => await _context.Bookings.AsNoTracking().Where(b => b.Id == targetId)
                .Select(b => "Đơn #" + b.Id.ToString().Substring(0, 8).ToUpper() + (b.Venue != null ? " – " + b.Venue.Name : "")).FirstOrDefaultAsync(),
            _ => null
        };
    }

    public async Task<Dictionary<(string, Guid), string?>> ResolveTargetNamesAsync(List<(string type, Guid id)> targets)
    {
        var result = new Dictionary<(string, Guid), string?>();
        var grouped = targets.Where(t => !string.IsNullOrWhiteSpace(t.type) && t.id != Guid.Empty).GroupBy(t => t.type.Trim().ToUpperInvariant());
        foreach (var group in grouped)
        {
            var type = group.Key;
            var ids = group.Select(g => g.id).Distinct().ToList();
            Dictionary<Guid, string?> names = type switch
            {
                "USER" => (await _context.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).Select(u => new { u.Id, Name = u.FullName }).ToListAsync()).ToDictionary(x => x.Id, x => (string?)x.Name),
                "VENUE" => (await _context.Venues.AsNoTracking().Where(v => ids.Contains(v.Id)).Select(v => new { v.Id, v.Name }).ToListAsync()).ToDictionary(x => x.Id, x => (string?)x.Name),
                "MATCHING_POST" => (await _context.MatchingPosts.AsNoTracking().Where(p => ids.Contains(p.Id)).Select(p => new { p.Id, Name = p.Title }).ToListAsync()).ToDictionary(x => x.Id, x => (string?)x.Name),
                "BOOKING" => (await _context.Bookings.AsNoTracking().Include(b => b.Venue).Where(b => ids.Contains(b.Id))
                    .Select(b => new { b.Id, Name = "Đơn #" + b.Id.ToString().Substring(0, 8).ToUpper() + (b.Venue != null ? " – " + b.Venue.Name : "") }).ToListAsync()).ToDictionary(x => x.Id, x => (string?)x.Name),
                _ => new Dictionary<Guid, string?>()
            };
            foreach (var id in ids) result[(type, id)] = names.TryGetValue(id, out var n) ? n : null;
        }
        return result;
    }

    public async Task DeactivateMatchingPostAsync(Guid postId)
    {
        var post = await _context.MatchingPosts.FirstOrDefaultAsync(p => p.Id == postId);
        if (post != null) { post.Status = "INACTIVE"; await _context.SaveChangesAsync(); }
    }

    public async Task<Guid?> ResolveTargetOwnerAsync(string? targetType, Guid targetId)
    {
        return targetType?.ToUpperInvariant() switch
        {
            "USER" => targetId,
            "VENUE" => (await _context.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == targetId))?.OwnerUserId,
            "MATCHING_POST" => (await _context.MatchingPosts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == targetId))?.CreatorUserId,
            "BOOKING" => (await _context.Bookings.AsNoTracking().Include(b => b.Venue).FirstOrDefaultAsync(b => b.Id == targetId))?.Venue?.OwnerUserId,
            _ => null
        };
    }

    public async Task<(Guid? venueOwnerId, string? venueName)?> GetBookingVenueInfoAsync(Guid bookingId)
    {
        var booking = await _context.Bookings.AsNoTracking().Include(b => b.Venue).FirstOrDefaultAsync(b => b.Id == bookingId);
        if (booking == null) return null;
        return (booking.Venue?.OwnerUserId, booking.Venue?.Name);
    }
}

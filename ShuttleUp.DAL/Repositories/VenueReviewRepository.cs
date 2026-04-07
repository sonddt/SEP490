using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class VenueReviewRepository : Repository<VenueReview>, IVenueReviewRepository
{
    private readonly ShuttleUpDbContext _db;

    public VenueReviewRepository(ShuttleUpDbContext context) : base(context)
    {
        _db = context;
    }

    public async Task<IEnumerable<VenueReview>> GetByVenueAsync(Guid venueId)
        => await _dbSet
            .Where(r => r.VenueId == venueId)
            .Include(r => r.User)
            .Include(r => r.Files)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

    public async Task<bool> HasUserReviewedBookingAsync(Guid bookingId, Guid userId)
        => await _dbSet.AnyAsync(r => r.BookingId == bookingId && r.UserId == userId);

    public async Task<VenueReview?> GetByIdWithIncludesAsync(Guid id)
        => await _dbSet
            .Include(r => r.User)
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.Id == id);

    public async Task<VenueReview?> GetByBookingAndUserAsync(Guid bookingId, Guid userId)
        => await _dbSet
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.BookingId == bookingId && r.UserId == userId);

    public async Task<bool> AllFilesOwnedByUserAsync(IEnumerable<Guid> fileIds, Guid userId)
    {
        var ids = fileIds.Distinct().ToList();
        if (ids.Count == 0) return true;
        if (ids.Count > 5) return false;
        var cnt = await _db.Set<ShuttleUp.DAL.Models.File>()
            .Where(f => ids.Contains(f.Id) && f.UploadedByUserId == userId)
            .CountAsync();
        return cnt == ids.Count;
    }

    public async Task AddReviewWithFilesAsync(VenueReview review, IEnumerable<Guid>? fileIds)
    {
        if (fileIds != null)
        {
            var ids = fileIds.Distinct().ToList();
            if (ids.Count > 5)
                throw new InvalidOperationException("Tối đa 5 ảnh đính kèm.");
            var fileRows = await _db.Set<ShuttleUp.DAL.Models.File>().Where(f => ids.Contains(f.Id)).ToListAsync();
            if (fileRows.Count != ids.Count)
                throw new InvalidOperationException("Một hoặc nhiều file không tồn tại.");
            foreach (var f in fileRows) review.Files.Add(f);
        }

        await _dbSet.AddAsync(review);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateReviewContentAndFilesAsync(Guid reviewId, int stars, string? comment, IEnumerable<Guid>? fileIds)
    {
        var loaded = await _dbSet
            .Include(r => r.Files)
            .FirstOrDefaultAsync(r => r.Id == reviewId);
        if (loaded == null)
            throw new InvalidOperationException("Không tìm thấy đánh giá.");

        loaded.Stars = stars;
        loaded.Comment = comment;

        // null = giữ nguyên ảnh; [] hoặc có phần tử = thay thế toàn bộ
        if (fileIds != null)
        {
            loaded.Files.Clear();
            var ids = fileIds.Distinct().ToList();
            if (ids.Count > 5)
                throw new InvalidOperationException("Tối đa 5 ảnh đính kèm.");
            var fileRows = await _db.Set<ShuttleUp.DAL.Models.File>().Where(f => ids.Contains(f.Id)).ToListAsync();
            if (fileRows.Count != ids.Count)
                throw new InvalidOperationException("Một hoặc nhiều file không tồn tại.");
            foreach (var f in fileRows) loaded.Files.Add(f);
        }

        await _db.SaveChangesAsync();
    }

    public async Task UpdateOwnerReplyAsync(Guid reviewId, string? replyText)
    {
        var r = await _dbSet.FirstOrDefaultAsync(x => x.Id == reviewId);
        if (r == null)
            throw new InvalidOperationException("Không tìm thấy đánh giá.");

        var trimmed = string.IsNullOrWhiteSpace(replyText) ? null : replyText.Trim();
        r.OwnerReply = trimmed;
        r.OwnerReplyAt = trimmed == null ? null : DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}

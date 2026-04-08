using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IVenueReviewRepository : IRepository<VenueReview>
{
    /// <summary>Lấy tất cả review của 1 venue, kèm user và ảnh.</summary>
    Task<IEnumerable<VenueReview>> GetByVenueAsync(Guid venueId);

    /// <summary>Kiểm tra user đã review venue này cho 1 booking cụ thể chưa</summary>
    Task<bool> HasUserReviewedBookingAsync(Guid bookingId, Guid userId);

    Task<VenueReview?> GetByIdWithIncludesAsync(Guid id);

    Task<VenueReview?> GetByBookingAndUserAsync(Guid bookingId, Guid userId);

    Task<bool> AllFilesOwnedByUserAsync(IEnumerable<Guid> fileIds, Guid userId);

    Task AddReviewWithFilesAsync(VenueReview review, IEnumerable<Guid>? fileIds);

    Task UpdateReviewContentAndFilesAsync(Guid reviewId, int stars, string? comment, IEnumerable<Guid>? fileIds);

    Task UpdateOwnerReplyAsync(Guid reviewId, string? replyText);
}

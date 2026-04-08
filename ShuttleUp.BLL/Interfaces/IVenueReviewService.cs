using ShuttleUp.BLL.DTOs.Review;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueReviewService
{
    Task<VenueRatingSummaryDto> GetVenueReviewsAsync(Guid venueId);

    Task<IReadOnlyList<EligibleBookingReviewDto>> GetEligibleBookingsForVenueAsync(Guid venueId, Guid userId);

    Task<ReviewResponseDto> CreateReviewAsync(Guid venueId, Guid userId, CreateReviewRequestDto request);

    Task<ReviewResponseDto> UpdateReviewAsync(Guid venueId, Guid userId, Guid reviewId, UpdateReviewRequestDto request);

    /// <summary>Chủ sân phản hồi đánh giá (đã xác minh venue từ controller).</summary>
    Task<ReviewResponseDto> SetOwnerReplyAsync(Guid reviewId, string? replyText);
}

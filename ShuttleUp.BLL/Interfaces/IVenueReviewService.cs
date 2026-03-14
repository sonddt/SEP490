using ShuttleUp.BLL.DTOs.Review;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueReviewService
{
    /// <summary>Lấy tất cả review + rating trung bình của 1 venue</summary>
    Task<VenueRatingSummaryDto> GetVenueReviewsAsync(Guid venueId);

    /// <summary>Tạo review mới (mỗi user chỉ review 1 venue 1 lần)</summary>
    Task<ReviewResponseDto> CreateReviewAsync(Guid venueId, Guid userId, CreateReviewRequestDto request);
}

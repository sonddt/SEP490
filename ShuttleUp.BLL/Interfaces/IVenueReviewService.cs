using ShuttleUp.BLL.DTOs.Review;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueReviewService
{
    /// <summary>Lấy tất cả review + rating trung bình của 1 venue</summary>
    Task<VenueRatingSummaryDto> GetVenueReviewsAsync(Guid venueId);

    /// <summary>
    /// Tạo review mới cho 1 booking của user tại venue.
    /// Mỗi booking chỉ được review tối đa 1 lần và chỉ khi:
    /// - Booking thuộc về user đó, đúng venue đó
    /// - Trạng thái booking = "CONFIRMED"
    /// - Thời điểm hiện tại không quá 3 ngày kể từ khi booking được tạo
    /// </summary>
    Task<ReviewResponseDto> CreateReviewAsync(Guid venueId, Guid userId, CreateReviewRequestDto request);
}

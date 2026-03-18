using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class VenueReviewService : IVenueReviewService
{
    private readonly IVenueReviewRepository _reviewRepository;
    private readonly IBookingRepository _bookingRepository;

    public VenueReviewService(
        IVenueReviewRepository reviewRepository,
        IBookingRepository bookingRepository)
    {
        _reviewRepository = reviewRepository;
        _bookingRepository = bookingRepository;
    }

    public async Task<VenueRatingSummaryDto> GetVenueReviewsAsync(Guid venueId)
    {
        var reviews = (await _reviewRepository.GetByVenueAsync(venueId)).ToList();

        var dtos = reviews.Select(r => new ReviewResponseDto
        {
            Id         = r.Id,
            VenueId    = r.VenueId!.Value,
            UserId     = r.UserId!.Value,
            UserFullName = r.User?.FullName ?? "Ẩn danh",
            Stars      = r.Stars ?? 0,
            Comment    = r.Comment,
            CreatedAt  = r.CreatedAt ?? DateTime.UtcNow,
        }).ToList();

        return new VenueRatingSummaryDto
        {
            ReviewCount  = dtos.Count,
            AverageStars = dtos.Count > 0 ? Math.Round(dtos.Average(r => r.Stars), 1) : 0,
            Reviews      = dtos,
        };
    }

    public async Task<ReviewResponseDto> CreateReviewAsync(
        Guid venueId, Guid userId, CreateReviewRequestDto request)
    {
        // 1. Kiểm tra booking hợp lệ
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId);
        if (booking == null
            || booking.UserId != userId
            || booking.VenueId != venueId)
        {
            throw new InvalidOperationException("Bạn không có quyền đánh giá cho đặt sân này.");
        }

        // 2. Chỉ cho phép khi status = CONFIRMED
        if (!string.Equals(booking.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chỉ có thể đánh giá khi lịch đặt đã được xác nhận (CONFIRMED).");
        }

        // 3. Hạn 3 ngày kể từ khi booking được tạo
        var createdAt = booking.CreatedAt ?? DateTime.UtcNow;
        if (DateTime.UtcNow > createdAt.AddDays(3))
        {
            throw new InvalidOperationException("Bạn chỉ có thể đánh giá trong vòng 3 ngày sau khi đặt sân.");
        }

        // 4. Mỗi booking chỉ được review 1 lần
        if (await _reviewRepository.HasUserReviewedBookingAsync(request.BookingId, userId))
            throw new InvalidOperationException("Bạn đã đánh giá cho lần đặt sân này rồi.");

        var review = new VenueReview
        {
            Id        = Guid.NewGuid(),
            VenueId   = venueId,
            UserId    = userId,
            BookingId = request.BookingId,
            Stars     = request.Stars,
            Comment   = request.Comment,
            CreatedAt = DateTime.UtcNow,
        };

        await _reviewRepository.AddAsync(review);

        // Load lại user để lấy tên
        var saved = (await _reviewRepository.GetByVenueAsync(venueId))
            .First(r => r.Id == review.Id);

        return new ReviewResponseDto
        {
            Id           = saved.Id,
            VenueId      = saved.VenueId!.Value,
            UserId       = saved.UserId!.Value,
            UserFullName = saved.User?.FullName ?? "Ẩn danh",
            Stars        = saved.Stars ?? 0,
            Comment      = saved.Comment,
            CreatedAt    = saved.CreatedAt ?? DateTime.UtcNow,
        };
    }
}

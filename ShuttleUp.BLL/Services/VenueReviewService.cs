using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class VenueReviewService : IVenueReviewService
{
    private readonly IVenueReviewRepository _reviewRepository;

    public VenueReviewService(IVenueReviewRepository reviewRepository)
    {
        _reviewRepository = reviewRepository;
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
        if (await _reviewRepository.HasUserReviewedAsync(venueId, userId))
            throw new InvalidOperationException("Bạn đã đánh giá sân này rồi.");

        var review = new VenueReview
        {
            Id        = Guid.NewGuid(),
            VenueId   = venueId,
            UserId    = userId,
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

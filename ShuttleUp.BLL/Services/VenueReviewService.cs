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
        var dtos = reviews.Select(MapToDto).ToList();

        return new VenueRatingSummaryDto
        {
            ReviewCount = dtos.Count,
            AverageStars = dtos.Count > 0 ? Math.Round(dtos.Average(r => r.Stars), 1) : 0,
            Reviews = dtos,
        };
    }

    public async Task<IReadOnlyList<EligibleBookingReviewDto>> GetEligibleBookingsForVenueAsync(Guid venueId, Guid userId)
    {
        var bookings = await _bookingRepository.GetConfirmedByUserAndVenueAsync(userId, venueId);
        var now = DateTime.UtcNow;
        var list = new List<EligibleBookingReviewDto>();

        foreach (var b in bookings)
        {
            var created = b.CreatedAt ?? now;
            var windowEnd = created.AddDays(3);
            var inWindow = now <= windowEnd;
            var existing = await _reviewRepository.GetByBookingAndUserAsync(b.Id, userId);

            var items = (b.BookingItems ?? [])
                .OrderBy(bi => bi.StartTime)
                .ToList();
            var first = items.FirstOrDefault();
            var last = items.LastOrDefault();

            var courtNames = items
                .Select(bi => bi.Court?.Name)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Distinct()
                .ToList();
            var courtLabel = courtNames.Count switch
            {
                0 => "Sân",
                1 => courtNames[0]!,
                _ => $"{courtNames.Count} sân",
            };

            var start = first?.StartTime;
            var end = last?.EndTime;
            var dateLabel = start.HasValue
                ? start.Value.ToString("dd/MM/yyyy")
                : created.ToString("dd/MM/yyyy");
            var timeLabel = start.HasValue && end.HasValue
                ? $"{start.Value:HH:mm} – {end.Value:HH:mm}"
                : "";

            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();

            list.Add(new EligibleBookingReviewDto
            {
                BookingId = b.Id,
                CreatedAt = created,
                ReviewWindowOpen = inWindow,
                ExistingReviewId = existing?.Id,
                CanSubmitNew = inWindow && existing == null,
                CanEditExisting = inWindow && existing != null,
                BookingCode = bookingCode,
                VenueName = b.Venue?.Name,
                CourtLabel = courtLabel,
                DateLabel = dateLabel,
                TimeLabel = timeLabel,
                FinalAmount = b.FinalAmount ?? b.TotalAmount ?? 0,
            });
        }

        return list;
    }

    public async Task<ReviewResponseDto> CreateReviewAsync(
        Guid venueId, Guid userId, CreateReviewRequestDto request)
    {
        var booking = await _bookingRepository.GetByIdAsync(request.BookingId);
        if (booking == null
            || booking.UserId != userId
            || booking.VenueId != venueId)
        {
            throw new InvalidOperationException("Bạn không có quyền đánh giá cho đặt sân này.");
        }

        if (!string.Equals(booking.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chỉ có thể đánh giá khi lịch đặt đã được xác nhận (CONFIRMED).");
        }

        ThrowIfOutsideReviewWindow(booking);

        if (await _reviewRepository.HasUserReviewedBookingAsync(request.BookingId, userId))
            throw new InvalidOperationException("Bạn đã đánh giá cho lần đặt sân này rồi.");

        if (request.FileIds != null && request.FileIds.Count > 0)
        {
            if (!await _reviewRepository.AllFilesOwnedByUserAsync(request.FileIds, userId))
                throw new InvalidOperationException("Ảnh không hợp lệ hoặc không thuộc tài khoản của bạn.");
        }

        var review = new VenueReview
        {
            Id = Guid.NewGuid(),
            VenueId = venueId,
            UserId = userId,
            BookingId = request.BookingId,
            Stars = request.Stars,
            Comment = request.Comment,
            CreatedAt = DateTime.UtcNow,
        };

        await _reviewRepository.AddReviewWithFilesAsync(review, request.FileIds);

        var saved = await _reviewRepository.GetByIdWithIncludesAsync(review.Id);
        return MapToDto(saved!);
    }

    public async Task<ReviewResponseDto> UpdateReviewAsync(
        Guid venueId, Guid userId, Guid reviewId, UpdateReviewRequestDto request)
    {
        var review = await _reviewRepository.GetByIdWithIncludesAsync(reviewId);
        if (review == null || review.UserId != userId || review.VenueId != venueId)
            throw new InvalidOperationException("Không tìm thấy đánh giá hoặc bạn không có quyền.");

        var booking = await _bookingRepository.GetByIdAsync(review.BookingId!.Value);
        if (booking == null)
            throw new InvalidOperationException("Không tìm thấy đơn đặt sân liên quan.");

        ThrowIfOutsideReviewWindow(booking);

        if (request.FileIds != null && request.FileIds.Count > 0)
        {
            if (!await _reviewRepository.AllFilesOwnedByUserAsync(request.FileIds, userId))
                throw new InvalidOperationException("Ảnh không hợp lệ hoặc không thuộc tài khoản của bạn.");
        }

        await _reviewRepository.UpdateReviewContentAndFilesAsync(
            reviewId, request.Stars, request.Comment, request.FileIds);

        var saved = await _reviewRepository.GetByIdWithIncludesAsync(reviewId);
        return MapToDto(saved!);
    }

    public async Task<ReviewResponseDto> SetOwnerReplyAsync(Guid reviewId, string? replyText)
    {
        await _reviewRepository.UpdateOwnerReplyAsync(reviewId, replyText);
        var saved = await _reviewRepository.GetByIdWithIncludesAsync(reviewId);
        return MapToDto(saved!);
    }

    private static void ThrowIfOutsideReviewWindow(Booking booking)
    {
        var createdAt = booking.CreatedAt ?? DateTime.UtcNow;
        if (DateTime.UtcNow > createdAt.AddDays(3))
        {
            throw new InvalidOperationException("Bạn chỉ có thể đánh giá hoặc sửa đánh giá trong vòng 3 ngày sau khi đặt sân.");
        }
    }

    private static ReviewResponseDto MapToDto(VenueReview r)
    {
        return new ReviewResponseDto
        {
            Id = r.Id,
            VenueId = r.VenueId!.Value,
            UserId = r.UserId!.Value,
            UserFullName = r.User?.FullName ?? "Ẩn danh",
            Stars = r.Stars ?? 0,
            Comment = r.Comment,
            CreatedAt = r.CreatedAt ?? DateTime.UtcNow,
            ImageUrls = r.Files?.Select(f => f.FileUrl).Where(u => !string.IsNullOrWhiteSpace(u)).ToList() ?? [],
            FileIds = r.Files?.Select(f => f.Id).ToList() ?? [],
            OwnerReply = r.OwnerReply,
            OwnerReplyAt = r.OwnerReplyAt,
        };
    }
}

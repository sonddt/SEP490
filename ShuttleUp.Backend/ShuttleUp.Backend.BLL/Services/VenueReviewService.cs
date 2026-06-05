using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class VenueReviewService : IVenueReviewService
{
    private readonly IVenueReviewRepository _reviewRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IVenueRepository _venueRepository;
    private readonly IUserRepository _userRepository;
    private readonly IFileRepository _fileRepository;
    private readonly IFileService _fileService;
    private readonly INotificationDispatchService _notify;

    public VenueReviewService(
        IVenueReviewRepository reviewRepository,
        IBookingRepository bookingRepository,
        IVenueRepository venueRepository,
        IUserRepository userRepository,
        IFileRepository fileRepository,
        IFileService fileService,
        INotificationDispatchService notify)
    {
        _reviewRepository = reviewRepository;
        _bookingRepository = bookingRepository;
        _venueRepository = venueRepository;
        _userRepository = userRepository;
        _fileRepository = fileRepository;
        _fileService = fileService;
        _notify = notify;
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
            var completedAt = b.CompletedAt;
            var windowEnd = completedAt.HasValue ? completedAt.Value.AddDays(3) : (DateTime?)null;
            var inWindow = completedAt.HasValue && now <= windowEnd!.Value;
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
                : (b.CreatedAt ?? now).ToString("dd/MM/yyyy");
            var timeLabel = start.HasValue && end.HasValue
                ? $"{start.Value:HH:mm} – {end.Value:HH:mm}"
                : "";

            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();

            list.Add(new EligibleBookingReviewDto
            {
                BookingId = b.Id,
                CreatedAt = b.CreatedAt ?? now,
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

        if (!string.Equals(booking.Status, "COMPLETED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chỉ có thể đánh giá khi lịch đặt đã hoàn thành (COMPLETED).");
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
        var result = MapToDto(saved!);

        // Gửi thông báo cho chủ sân
        try
        {
            var venue = await _venueRepository.GetByIdAsync(venueId);
            if (venue?.OwnerUserId != null && venue.OwnerUserId != userId)
            {
                var reviewer = await _userRepository.GetByIdAsync(userId);
                var name = reviewer?.FullName ?? "Người chơi";
                await _notify.NotifyUserAsync(
                    venue.OwnerUserId.Value,
                    "VENUE_REVIEW_NEW", // Hoặc NotificationTypes.VenueReviewNew
                    "Có đánh giá mới tại sân",
                    $"{name} vừa đánh giá {result.Stars} sao.",
                    new
                    {
                        deepLink = $"/manager/venues/{venueId}/courts",
                        venueId,
                        reviewId = result.Id,
                    },
                    sendEmail: false);
            }
        }
        catch { /* Bỏ qua nếu lỗi notify để tránh ngắt luồng chính */ }

        return result;
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
        var completedAt = booking.CompletedAt;
        if (!completedAt.HasValue)
        {
            throw new InvalidOperationException("Đơn đặt sân chưa hoàn thành, bạn chưa thể đánh giá.");
        }
        if (DateTime.UtcNow > completedAt.Value.AddDays(3))
        {
            throw new InvalidOperationException("Bạn chỉ có thể đánh giá hoặc sửa đánh giá trong vòng 3 ngày sau khi hoàn thành lịch chơi.");
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

    public async Task<ShuttleUp.BLL.DTOs.Profile.ManagerDocumentDto> UploadReviewImageAsync(Guid venueId, Guid userId, Microsoft.AspNetCore.Http.IFormFile file, System.Threading.CancellationToken ct = default)
    {
        var venue = await _venueRepository.GetByIdAsync(venueId);
        if (venue == null || venue.IsActive == false)
            throw new KeyNotFoundException("Không tìm thấy sân.");

        if (file == null || file.Length <= 0)
            throw new ArgumentException("Vui lòng chọn ảnh.");

        // Validate max bytes (3MB)
        if (file.Length > 3_000_000)
            throw new ArgumentException("Ảnh tối đa 3 MB.");

        if (file.ContentType == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Chỉ được đính kèm file ảnh.");

        // Magic number validation
        await using (var stream = file.OpenReadStream())
        {
            // Đọc header của stream để kiểm tra ảnh hợp lệ
            var buffer = new byte[8];
            var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
            if (bytesRead >= 4)
            {
                // Kiểm tra JPEG hoặc PNG (FF D8 FF hoặc 89 50 4E 47)
                var isJpeg = buffer[0] == 0xFF && buffer[1] == 0xD8 && buffer[2] == 0xFF;
                var isPng = buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4E && buffer[3] == 0x47;
                var isGif = buffer[0] == 0x47 && buffer[1] == 0x49 && buffer[2] == 0x46 && buffer[3] == 0x38;
                if (!isJpeg && !isPng && !isGif)
                    throw new ArgumentException("Ảnh không đúng định dạng (hệ thống chỉ nhận JPEG, PNG, GIF).");
            }
            else
            {
                throw new ArgumentException("Ảnh không hợp lệ.");
            }
        }

        var upload = await _fileService.UploadVenueReviewImageAsync(file, venueId, userId, ct);
        var secureUrl = upload.SecureUrl;

        var fileRow = new ShuttleUp.DAL.Models.File
        {
            Id = Guid.NewGuid(),
            FileUrl = secureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _fileRepository.AddFileAsync(fileRow);
        return new ShuttleUp.BLL.DTOs.Profile.ManagerDocumentDto
        {
            Id = fileRow.Id,
            Url = fileRow.FileUrl,
            MimeType = fileRow.MimeType
        };
    }
}

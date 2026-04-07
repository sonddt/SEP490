using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FileEntity = ShuttleUp.DAL.Models.File;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Helpers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/venues/{venueId}/reviews")]
public class VenueReviewsController : ControllerBase
{
    private readonly IVenueReviewService _reviewService;
    private readonly IFileService _fileService;
    private readonly ShuttleUpDbContext _db;
    private readonly INotificationDispatchService _notify;

    public VenueReviewsController(
        IVenueReviewService reviewService,
        IFileService fileService,
        ShuttleUpDbContext db,
        INotificationDispatchService notify)
    {
        _reviewService = reviewService;
        _fileService = fileService;
        _db = db;
        _notify = notify;
    }

    /// <summary>Lấy tất cả review + rating trung bình của 1 venue (public)</summary>
    [HttpGet]
    public async Task<IActionResult> GetReviews(Guid venueId)
    {
        var result = await _reviewService.GetVenueReviewsAsync(venueId);
        return Ok(result);
    }

    /// <summary>Booking CONFIRMED của user tại venue + trạng thái có thể gửi/sửa review (trong 3 ngày).</summary>
    [HttpGet("eligible-bookings")]
    [Authorize]
    public async Task<IActionResult> GetEligibleBookings(Guid venueId)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Token không hợp lệ." });

        var list = await _reviewService.GetEligibleBookingsForVenueAsync(venueId, userId);
        return Ok(list);
    }

    /// <summary>Tải ảnh minh họa đánh giá (Cloudinary + bản ghi files). Gọi trước khi tạo/sửa review.</summary>
    [HttpPost("upload-image")]
    [Authorize]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(3_000_000)]
    public async Task<IActionResult> UploadReviewImage(Guid venueId, IFormFile file)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Token không hợp lệ." });

        var venueExists = await _db.Venues.AsNoTracking().AnyAsync(v => v.Id == venueId && v.IsActive == true);
        if (!venueExists)
            return NotFound(new { message = "Không tìm thấy sân." });

        if (file == null || file.Length <= 0)
            return BadRequest(new { message = "Vui lòng chọn ảnh." });
        if (file.Length > VenueReviewUploadValidator.MaxBytes)
            return BadRequest(new { message = $"Ảnh tối đa {VenueReviewUploadValidator.MaxBytes / 1_000_000.0:0.#} MB." });
        if (file.ContentType == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ được đính kèm file ảnh." });

        await using (var stream = file.OpenReadStream())
        {
            if (!VenueReviewUploadValidator.TryValidateImageHeader(stream, out var hdrErr))
                return BadRequest(new { message = hdrErr ?? "Ảnh không hợp lệ." });
        }

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadVenueReviewImageAsync(file, venueId, userId, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message });
        }

        var fileRow = new FileEntity
        {
            Id = Guid.NewGuid(),
            FileUrl = secureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.Files.Add(fileRow);
        await _db.SaveChangesAsync();

        return Ok(new { fileId = fileRow.Id, url = secureUrl });
    }

    /// <summary>Gửi đánh giá mới (yêu cầu đăng nhập)</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateReview(Guid venueId, [FromBody] CreateReviewRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Token không hợp lệ." });

        try
        {
            var result = await _reviewService.CreateReviewAsync(venueId, userId, request);

            var venue = await _db.Venues.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == venueId);
            if (venue?.OwnerUserId != null && venue.OwnerUserId != userId)
            {
                var reviewer = await _db.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId);
                var name = reviewer?.FullName ?? "Người chơi";
                await _notify.NotifyUserAsync(
                    venue.OwnerUserId.Value,
                    NotificationTypes.VenueReviewNew,
                    "Có đánh giá mới tại sân",
                    $"{name} vừa đánh giá {result.Stars} sao.",
                    new
                    {
                        deepLink = $"/manager/venues/{venueId}/courts",
                        venueId,
                        reviewId = result.Id,
                    },
                    sendEmail: false,
                    cancellationToken: HttpContext.RequestAborted);
            }

            return CreatedAtAction(nameof(GetReviews), new { venueId }, result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    /// <summary>Sửa đánh giá (trong 3 ngày kể từ lúc tạo booking)</summary>
    [HttpPut("{reviewId:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateReview(
        Guid venueId, Guid reviewId, [FromBody] UpdateReviewRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!TryGetUserId(out var userId))
            return Unauthorized(new { message = "Token không hợp lệ." });

        try
        {
            var result = await _reviewService.UpdateReviewAsync(venueId, userId, reviewId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(userIdStr, out userId);
    }
}

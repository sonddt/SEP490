using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/venues/{venueId}/reviews")]
public class VenueReviewsController : ControllerBase
{
    private readonly IVenueReviewService _reviewService;

    public VenueReviewsController(IVenueReviewService reviewService)
    {
        _reviewService = reviewService;
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

        try
        {
            var result = await _reviewService.UploadReviewImageAsync(venueId, userId, file, HttpContext.RequestAborted);
            return Ok(new { fileId = result.Id, url = result.Url });
        }
        catch (System.Collections.Generic.KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message });
        }
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

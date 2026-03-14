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

    /// <summary>Gửi đánh giá mới (yêu cầu đăng nhập)</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateReview(Guid venueId, [FromBody] CreateReviewRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userIdStr, out var userId))
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
}

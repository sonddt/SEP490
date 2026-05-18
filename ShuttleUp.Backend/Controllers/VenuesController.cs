using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Public/player-facing APIs for browsing venues.
/// Chỉ trả về các venue đã được admin duyệt và đang hoạt động.
/// </summary>
[ApiController]
[Route("api/venues")]
public class VenuesController : ControllerBase
{
    private readonly IVenueService _venueService;

    public VenuesController(IVenueService venueService)
    {
        _venueService = venueService;
    }

    /// <summary>
    /// Lấy chi tiết một venue (dùng cho trang VenueDetails).
    /// Chỉ trả về nếu venue đã APPROVED và đang hoạt động.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVenueById([FromRoute] Guid id)
    {
        var vnTz = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "SE Asia Standard Time" : "Asia/Ho_Chi_Minh");
        var currentDayOfWeek = (int)TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz).DayOfWeek;

        var result = await _venueService.GetPublicVenueDetailsAsync(id, currentDayOfWeek, HttpContext.RequestAborted);
        if (result == null) return NotFound();

        return Ok(result);
    }

    /// <summary>
    /// Danh sách venues nhẹ dành cho render Map.
    /// Có hỗ trợ lọc nhanh bằng search, minPrice, maxPrice, amenities, cancelAllowed.
    /// </summary>
    [HttpGet("map")]
    public async Task<IActionResult> GetMapVenues(
        [FromQuery] string? search = null,
        [FromQuery] decimal? minPrice = null,
        [FromQuery] decimal? maxPrice = null,
        [FromQuery] string? amenities = null,
        [FromQuery] bool? cancelAllowed = null)
    {
        var result = await _venueService.GetMapVenuesAsync(search, minPrice, maxPrice, amenities, cancelAllowed, HttpContext.RequestAborted);
        return Ok(result);
    }

    /// <summary>
    /// Danh sách venues cho player.
    /// Chỉ bao gồm venues APPROVED + IsActive = true.
    /// Hỗ trợ sort theo giá min tăng dần / giảm dần.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetApprovedVenues(
        [FromQuery] string? sortBy = "price",
        [FromQuery] string? sortDir = "asc")
    {
        var result = await _venueService.GetApprovedVenuesPublicAsync(sortBy, sortDir, HttpContext.RequestAborted);
        return Ok(result);
    }

    /// <summary>
    /// Danh sách sân đang hoạt động + bảng giá (đặt lịch).
    /// </summary>
    [HttpGet("{id:guid}/courts")]
    public async Task<IActionResult> GetVenueCourts([FromRoute] Guid id)
    {
        var result = await _venueService.GetVenueCourtsPublicAsync(id, HttpContext.RequestAborted);
        // The service does not return null if venue doesn't exist, it just returns an empty list. 
        // We could handle returning 404 in service or controller if needed, but returning empty array is usually fine for a sub-resource.
        return Ok(result);
    }

    /// <summary>
    /// Khung giờ đã đặt / bị khóa trong một ngày (YYYY-MM-DD), theo từng sân.
    /// </summary>
    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> GetVenueAvailability([FromRoute] Guid id, [FromQuery] string date)
    {
        var userIdClaim = User.Identity?.IsAuthenticated == true
            ? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            : null;
            
        Guid? currentUserGuid = null;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var parsedUserId))
            currentUserGuid = parsedUserId;

        try
        {
            var result = await _venueService.GetVenueAvailabilityAsync(id, date, currentUserGuid, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    /// <summary>
    /// Thông tin thanh toán + chính sách huỷ (public, cho trang thanh toán đặt sân).
    /// amount/addInfo dùng để tạo URL ảnh VietQR.
    /// </summary>
    [HttpGet("{id:guid}/checkout-settings")]
    public async Task<IActionResult> GetCheckoutSettings(
        [FromRoute] Guid id,
        [FromQuery] decimal? amount,
        [FromQuery] string? addInfo)
    {
        var result = await _venueService.GetCheckoutSettingsPublicAsync(id, amount, addInfo, HttpContext.RequestAborted);
        if (result == null) return NotFound();
        
        return Ok(result);
    }
}

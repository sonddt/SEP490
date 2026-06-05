using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Constants;
using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.DTOs.Venue;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.BLL.Services;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/venues")]
[Authorize(Roles = "MANAGER")]
public class ManagerVenuesController : ControllerBase
{
    private readonly IVenueService _venueService;
    private readonly ICourtService _courtService;
    private readonly VietQRSettings _vietQrSettings;
    private readonly INotificationDispatchService _notify;
    private readonly IVenueReviewService _venueReviewService;
    private readonly IBankLookupService _bankLookupService;

    public ManagerVenuesController(
        IVenueService venueService, ICourtService courtService,
        IOptions<VietQRSettings> vietQrOptions, INotificationDispatchService notify,
        IVenueReviewService venueReviewService, IBankLookupService bankLookupService)
    {
        _venueService = venueService;
        _courtService = courtService;
        _vietQrSettings = vietQrOptions.Value;
        _notify = notify;
        _venueReviewService = venueReviewService;
        _bankLookupService = bankLookupService;
    }

    // ── REVIEWS ──
    [HttpPut("{venueId:guid}/reviews/{reviewId:guid}/reply")]
    public async Task<IActionResult> ReplyToVenueReview([FromRoute] Guid venueId, [FromRoute] Guid reviewId, [FromBody] OwnerReplyRequestDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try
        {
            var venue = await _venueService.GetByIdAsync(venueId);
            if (venue == null) return NotFound(new { message = "Venue không tồn tại." });
            if (venue.OwnerUserId != mid) return Forbid();
            var result = await _venueReviewService.SetOwnerReplyAsync(reviewId, dto.Reply);
            var replyTrim = (dto.Reply ?? "").Trim();
            if (replyTrim.Length > 0 && result.UserId != mid)
                await _notify.NotifyUserAsync(result.UserId, NotificationTypes.VenueReviewReply, "Chủ sân đã phản hồi đánh giá của bạn",
                    $"{venue.Name ?? "Sân"} vừa trả lời đánh giá của bạn.",
                    new { deepLink = $"/venue-details/{venueId}#reviews", venueId, reviewId }, sendEmail: false, cancellationToken: HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── VENUE CRUD ──
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetManagedVenueById([FromRoute] Guid id)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        var result = await _venueService.GetManagedVenueDetailAsync(id, mid);
        return result == null ? NotFound(new { message = "Venue không tồn tại hoặc bạn không có quyền truy cập." }) : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> AddVenue([FromBody] ManagerVenueUpsertDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        if (request.Lat is < -90 or > 90) return BadRequest(new { message = "Vĩ độ phải nằm trong khoảng -90 đến 90." });
        if (request.Lng is < -180 or > 180) return BadRequest(new { message = "Kinh độ phải nằm trong khoảng -180 đến 180." });

        var venue = new ShuttleUp.DAL.Models.Venue
        {
            OwnerUserId = mid, Name = request.Name, Address = request.Address, Lat = request.Lat, Lng = request.Lng,
            ContactName = request.ContactName, ContactPhone = request.ContactPhone,
            WeeklyDiscountPercent = request.WeeklyDiscountPercent, MonthlyDiscountPercent = request.MonthlyDiscountPercent,
            Description = request.Description,
            Includes = request.Includes != null ? JsonSerializer.Serialize(request.Includes) : null,
            Rules = request.Rules != null ? JsonSerializer.Serialize(request.Rules) : null,
            Amenities = request.Amenities != null ? JsonSerializer.Serialize(request.Amenities) : null,
            SlotDuration = request.SlotDuration == 30 || request.SlotDuration == 120 ? request.SlotDuration : 60
        };
        await _venueService.CreateAsync(venue);
        return CreatedAtAction(nameof(GetManagedVenues), new { id = venue.Id }, new { venue.Id, venue.Name, venue.Address, venue.ContactName, venue.ContactPhone, venue.IsActive, venue.CreatedAt });
    }

    [HttpPut("{venueId}")]
    public async Task<IActionResult> EditVenue([FromRoute] Guid venueId, [FromBody] ManagerVenueUpsertDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        if (request.Lat is < -90 or > 90) return BadRequest(new { message = "Vĩ độ phải nằm trong khoảng -90 đến 90." });
        if (request.Lng is < -180 or > 180) return BadRequest(new { message = "Kinh độ phải nằm trong khoảng -180 đến 180." });
        try { return Ok(await _venueService.EditVenueAsync(venueId, mid, request)); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{venueId}")]
    public async Task<IActionResult> DeleteVenue([FromRoute] Guid venueId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { await _venueService.DeleteVenueAsync(venueId, mid); return NoContent(); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPut("{venueId}/publish")]
    public async Task<IActionResult> PublishVenue([FromRoute] Guid venueId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _venueService.PublishVenueAsync(venueId, mid)); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{venueId}/unpublish")]
    public async Task<IActionResult> UnpublishVenue([FromRoute] Guid venueId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _venueService.UnpublishVenueAsync(venueId, mid)); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet]
    public async Task<IActionResult> GetManagedVenues([FromQuery] string? search, [FromQuery] string? sortBy, [FromQuery] string? sortDir, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        return Ok(await _venueService.GetManagedVenuesPagedAsync(mid, search, sortBy, sortDir, page, pageSize));
    }

    // ── VENUE FILES ──
    [HttpPost("{venueId}/files"), Consumes("multipart/form-data"), RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadVenueFiles([FromRoute] Guid venueId, [FromForm(Name = "imageFiles")] List<IFormFile> imageFiles, [FromForm] bool isThumbnail = false)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try
        {
            var files = imageFiles.Select(f => new FileUploadInfo { Stream = f.OpenReadStream(), FileName = (isThumbnail ? $"venue_{venueId}_mac_dinh_{Guid.NewGuid():N}"[..40] : f.FileName), ContentType = f.ContentType, Length = f.Length }).ToList();
            return Ok(await _venueService.UploadVenueFilesAsync(venueId, mid, files));
        }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{venueId}/files")]
    public async Task<IActionResult> DeleteVenueFile([FromRoute] Guid venueId, [FromQuery] string fileUrl)
    {
        // Kept minimal — file deletion uses a simple pattern via service
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        if (string.IsNullOrWhiteSpace(fileUrl)) return BadRequest(new { message = "Thiếu fileUrl." });
        try { await _venueService.DeleteVenueFileAsync(venueId, fileUrl, mid); return Ok(new { message = "Đã xóa ảnh." }); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Không tìm thấy ảnh." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    // ── COURT CRUD ──
    [HttpPost("{venueId}/courts")]
    public async Task<IActionResult> AddCourt([FromRoute] Guid venueId, [FromBody] ManagerCourtUpsertDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.CreateCourtWithConfigAsync(venueId, mid, request)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{venueId}/courts/{courtId}")]
    public async Task<IActionResult> EditCourt([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromBody] ManagerCourtUpsertDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.UpdateCourtWithConfigAsync(venueId, courtId, mid, request)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPatch("{venueId}/courts/{courtId}/status")]
    public async Task<IActionResult> SetCourtStatus([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromBody] CourtStatusUpdateDto request)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.SetCourtStatusAsync(venueId, courtId, mid, request.IsActive, request.Force)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ConflictException ex) { return Conflict(new { message = ex.Message, count = ex.Count }); }
    }

    [HttpPost("{venueId}/courts/{courtId}/files"), Consumes("multipart/form-data"), RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadCourtFiles([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromForm(Name = "imageFiles")] List<IFormFile> imageFiles)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try
        {
            var files = (imageFiles ?? new List<IFormFile>()).Select(f => new FileUploadInfo { Stream = f.OpenReadStream(), FileName = f.FileName, ContentType = f.ContentType, Length = f.Length }).ToList();
            return Ok(await _courtService.UploadCourtFilesAsync(venueId, courtId, mid, files));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("{venueId}/courts/{courtId}")]
    public async Task<IActionResult> GetCourtDetails([FromRoute] Guid venueId, [FromRoute] Guid courtId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try
        {
            var result = await _courtService.GetCourtDetailAsync(venueId, courtId, mid);
            return result == null ? NotFound(new { message = "Court không tồn tại." }) : Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpDelete("{venueId}/courts/{courtId}")]
    public async Task<IActionResult> DeleteCourt([FromRoute] Guid venueId, [FromRoute] Guid courtId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null) return NotFound(new { message = "Venue không tồn tại." });
        if (venue.OwnerUserId != mid) return Forbid();
        var court = await _courtService.GetByIdAsync(courtId);
        if (court == null || court.VenueId != venueId) return NotFound(new { message = "Court không tồn tại." });
        await _courtService.DeleteAsync(courtId);
        return NoContent();
    }

    [HttpGet("{venueId}/courts")]
    public async Task<IActionResult> GetCourtsInVenue([FromRoute] Guid venueId, [FromQuery] string? search, [FromQuery] string? sortBy, [FromQuery] string? sortDir, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.GetCourtsPagedAsync(venueId, mid, search, sortBy, sortDir, page, pageSize)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    // ── COURT BLOCKS ──
    [HttpGet("{venueId:guid}/courts/{courtId:guid}/blocks")]
    public async Task<IActionResult> GetCourtBlocks([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromQuery] string? from, [FromQuery] string? to)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.GetCourtBlocksAsync(venueId, courtId, mid, from, to)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{venueId:guid}/courts/{courtId:guid}/blocks")]
    public async Task<IActionResult> CreateCourtBlock([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromBody] CourtBlockUpsertDto dto)
    {
        if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu." });
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try
        {
            var result = await _courtService.CreateCourtBlockAsync(venueId, courtId, mid, dto);
            // Notification (cross-cutting)
            foreach (var uid in result.AffectedUserIds)
            {
                var window = $"{result.StartTime:dd/MM/yyyy HH:mm} – {result.EndTime:dd/MM/yyyy HH:mm}";
                await _notify.NotifyUserAsync(uid, NotificationTypes.CourtBlock, "Lịch sân cập nhật",
                    $"Sân {result.CourtName} tại {result.VenueName}: khóa tạm {window}. Lý do: {result.ReasonLabel}.",
                    new { venueId, courtId, entityType = "court_block", deepLink = $"/booking?venueId={venueId}" },
                    sendEmail: false, cancellationToken: HttpContext.RequestAborted);
            }
            return Ok(result.Block);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{venueId:guid}/courts/{courtId:guid}/blocks/{blockId:guid}")]
    public async Task<IActionResult> UpdateCourtBlock([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromRoute] Guid blockId, [FromBody] CourtBlockUpsertDto dto)
    {
        if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu." });
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _courtService.UpdateCourtBlockAsync(venueId, courtId, blockId, mid, dto)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{venueId:guid}/courts/{courtId:guid}/blocks/{blockId:guid}")]
    public async Task<IActionResult> DeleteCourtBlock([FromRoute] Guid venueId, [FromRoute] Guid courtId, [FromRoute] Guid blockId)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { await _courtService.DeleteCourtBlockAsync(venueId, courtId, blockId, mid); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    // ── CHECKOUT SETTINGS ──
    [HttpGet("{venueId:guid}/checkout-settings")]
    public async Task<IActionResult> GetCheckoutSettingsForManager([FromRoute] Guid venueId, [FromQuery] decimal? amount, [FromQuery] string? addInfo)
    {
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        var result = await _venueService.GetCheckoutSettingsAsync(venueId, mid, amount, addInfo);
        return result == null ? NotFound(new { message = "Venue không tồn tại hoặc bạn không có quyền." }) : Ok(result);
    }

    [HttpPut("{venueId:guid}/checkout-settings")]
    public async Task<IActionResult> PutCheckoutSettings([FromRoute] Guid venueId, [FromBody] VenueCheckoutSettingsDto dto)
    {
        if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu." });
        var mid = GetCurrentUserId(); if (mid == Guid.Empty) return Unauthorized();
        try { return Ok(await _venueService.SaveCheckoutSettingsAsync(venueId, mid, dto)); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Venue không tồn tại." }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("bank-lookup")]
    public async Task<IActionResult> LookupBankAccount([FromBody] BankLookupDto dto)
    {
        if (string.IsNullOrWhiteSpace(_vietQrSettings.ClientId) || string.IsNullOrWhiteSpace(_vietQrSettings.ApiKey))
            return Ok(new { configured = false, message = "Tính năng tra cứu chưa được cấu hình, vui lòng nhập tay." });
        try { return Ok(await _bankLookupService.LookupBankAccountAsync(dto.Bin, dto.AccountNumber, _vietQrSettings.ClientId, _vietQrSettings.ApiKey, _vietQrSettings.LookupUrl)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── COUPONS ──
    [HttpGet("{venueId:guid}/coupons")]
    public async Task<IActionResult> GetCoupons([FromRoute] Guid venueId)
    {
        var mid = GetCurrentUserId();
        try { return Ok(await _venueService.GetCouponsAsync(venueId, mid)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("{venueId:guid}/coupons")]
    public async Task<IActionResult> CreateCoupon([FromRoute] Guid venueId, [FromBody] CouponUpsertDto dto)
    {
        var mid = GetCurrentUserId();
        try { return Ok(await _venueService.CreateCouponAsync(venueId, mid, dto)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{venueId:guid}/coupons/{couponId:guid}")]
    public async Task<IActionResult> UpdateCoupon([FromRoute] Guid venueId, [FromRoute] Guid couponId, [FromBody] CouponUpsertDto dto)
    {
        var mid = GetCurrentUserId();
        try { return Ok(await _venueService.UpdateCouponAsync(venueId, couponId, mid, dto)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{venueId:guid}/coupons/{couponId:guid}")]
    public async Task<IActionResult> DeleteCoupon([FromRoute] Guid venueId, [FromRoute] Guid couponId)
    {
        var mid = GetCurrentUserId();
        try { await _venueService.DeleteCouponAsync(venueId, couponId, mid); return Ok(new { message = "Xoá coupon thành công." }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
    }
}

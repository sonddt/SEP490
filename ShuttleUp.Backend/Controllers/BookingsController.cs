using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend.BookingForms;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IFileService _fileService;
    private readonly IBookingCreationService _bookingCreationService;
    private readonly IBookingValidationService _bookingValidationService;
    private readonly IBookingService _bookingService;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;

    public BookingsController(
        IFileService fileService,
        IBookingCreationService bookingCreationService,
        IBookingValidationService bookingValidationService,
        IBookingService bookingService,
        IConfiguration configuration,
        IMemoryCache cache)
    {
        _fileService = fileService;
        _bookingCreationService = bookingCreationService;
        _bookingValidationService = bookingValidationService;
        _bookingService = bookingService;
        _configuration = configuration;
        _cache = cache;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            if (dto.BookingId.HasValue)
            {
                var updateResult = await _bookingCreationService.UpdateHoldingBookingContactAsync(
                    dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note, HttpContext.RequestAborted);
                return Ok(updateResult);
            }

            var result = await _bookingCreationService.CreateBookingAsync(userId, dto, HttpContext.RequestAborted);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("long-term/preview")]
    public async Task<IActionResult> PreviewLongTerm([FromBody] LongTermScheduleDto dto)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var built = await _bookingValidationService.BuildLongTermNormalizedAsync(dto, currentUserId, HttpContext.RequestAborted);

            if (built.SmartItems != null)
            {
                var availableItems = built.SmartItems.Where(x => !x.IsUnavailable).ToList();
                var total = availableItems.Sum(x => x.Price);
                var sessionCount = availableItems.Select(x => DateOnly.FromDateTime(x.Start)).Distinct().Count();
                var primaryCourtName = availableItems.GroupBy(x => x.CourtName).OrderByDescending(g => g.Count()).FirstOrDefault()?.Key ?? "—";

                return Ok(new
                {
                    venueId = dto.VenueId,
                    courtId = (Guid?)null,
                    courtName = primaryCourtName,
                    slotCount = availableItems.Count,
                    unavailableCount = built.SmartItems.Count(x => x.IsUnavailable),
                    sessionCount,
                    totalAmount = total,
                    isFlexible = true,
                    items = built.SmartItems.Select(x => new
                    {
                        courtId = x.CourtId,
                        courtName = x.CourtName,
                        startTime = x.Start,
                        endTime = x.End,
                        price = x.Price,
                        isUnavailable = x.IsUnavailable,
                        isSwitched = x.IsSwitched,
                        switchReason = x.SwitchReason,
                    }),
                });
            }

            var legacyTotal = built.NormalizedItems.Sum(x => x.Price);
            var legacySessionCount = built.NormalizedItems.Select(x => DateOnly.FromDateTime(x.Start)).Distinct().Count();

            return Ok(new
            {
                venueId = dto.VenueId,
                courtId = dto.CourtId,
                courtName = built.Court?.Name,
                slotCount = built.NormalizedItems.Count,
                unavailableCount = 0,
                sessionCount = legacySessionCount,
                totalAmount = legacyTotal,
                isFlexible = false,
                items = built.NormalizedItems.Select(x => new
                {
                    courtId = (Guid?)x.CourtId,
                    courtName = built.Court?.Name,
                    startTime = x.Start,
                    endTime = x.End,
                    price = x.Price,
                    isUnavailable = false,
                    isSwitched = false,
                    switchReason = (string?)null,
                }),
            });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("long-term")]
    public async Task<IActionResult> CreateLongTermBooking([FromBody] LongTermBookingRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (string.IsNullOrWhiteSpace(dto.ContactName))
            return BadRequest(new { message = "Vui lòng nhập họ tên." });
        if (string.IsNullOrWhiteSpace(dto.ContactPhone))
            return BadRequest(new { message = "Vui lòng nhập số điện thoại." });

        try
        {
            if (dto.BookingId.HasValue)
            {
                var updateResult = await _bookingCreationService.UpdateHoldingBookingContactAsync(
                    dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note, HttpContext.RequestAborted);
                return Ok(updateResult);
            }

            var result = await _bookingCreationService.CreateLongTermBookingAsync(userId, dto, HttpContext.RequestAborted);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("long-term/flexible/preview")]
    public async Task<IActionResult> PreviewLongTermFlexible([FromBody] LongTermFlexibleScheduleDto dto)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var built = await _bookingValidationService.BuildFlexibleLongTermAsync(dto, currentUserId, HttpContext.RequestAborted);
            var total = built.NormalizedItems.Sum(x => x.Price);
            var sessionCount = built.NormalizedItems.Select(x => DateOnly.FromDateTime(x.Start)).Distinct().Count();

            return Ok(new
            {
                venueId = dto.VenueId,
                slotCount = built.NormalizedItems.Count,
                sessionCount,
                totalAmount = total,
                rangeStart = built.RangeStart,
                rangeEnd = built.RangeEnd,
                items = built.NormalizedItems.Select(x => new
                {
                    courtId = x.CourtId,
                    courtName = built.CourtById.GetValueOrDefault(x.CourtId)?.Name,
                    startTime = x.Start,
                    endTime = x.End,
                    price = x.Price,
                }),
            });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("long-term/flexible")]
    public async Task<IActionResult> CreateLongTermFlexibleBooking([FromBody] LongTermFlexibleBookingRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (string.IsNullOrWhiteSpace(dto.ContactName))
            return BadRequest(new { message = "Vui lòng nhập họ tên." });
        if (string.IsNullOrWhiteSpace(dto.ContactPhone))
            return BadRequest(new { message = "Vui lòng nhập số điện thoại." });

        try
        {
            if (dto.BookingId.HasValue)
            {
                var updateResult = await _bookingCreationService.UpdateHoldingBookingContactAsync(
                    dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note, HttpContext.RequestAborted);
                return Ok(updateResult);
            }

            var result = await _bookingCreationService.CreateLongTermFlexibleBookingAsync(userId, dto, HttpContext.RequestAborted);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyBookings()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var rows = await _bookingService.GetMyBookingsAsync(userId, HttpContext.RequestAborted);
            return Ok(rows);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/cancel-preview")]
    public async Task<IActionResult> CancelPreview([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var preview = await _bookingService.GetCancelPreviewAsync(id, userId, HttpContext.RequestAborted);
            return Ok(new
            {
                bookingId = preview.BookingId,
                bookingCode = preview.BookingCode,
                bookingStatus = preview.BookingStatus,
                venueName = preview.VenueName,
                isLongTerm = preview.IsLongTerm,
                cancelBranch = preview.CancelBranch,
                canCancel = preview.CanCancel,
                disableReason = preview.DisableReason,
                policy = preview.Policy,
                payment = preview.Payment,
                refund = preview.Refund,
            });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> CancelMyBooking([FromRoute] Guid id, [FromBody] CancelBookingBodyDto? body)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var result = await _bookingService.CancelMyBookingAsync(id, userId, body, HttpContext.RequestAborted);
            return Ok(new
            {
                message = result.Message,
                bookingId = id,
                bookingCode = "SU" + id.ToString("N")[^6..].ToUpperInvariant(),
                status = result.Status,
                cancelBranch = result.CancelBranch,
                refundRequestId = result.RefundRequestId,
            });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/cancel-hold")]
    public async Task<IActionResult> CancelHold([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var result = await _bookingService.CancelHoldAsync(id, userId, HttpContext.RequestAborted);
            return Ok(new
            {
                message = "Đã huỷ giữ chỗ thành công. Các khung giờ đã được giải phóng.",
                bookingId = result.BookingId,
                status = result.Status,
            });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPatch("{id:guid}/refund-bank-info")]
    public async Task<IActionResult> UpdateRefundBankInfo([FromRoute] Guid id, [FromBody] CancelBookingBodyDto body)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            await _bookingService.UpdateRefundBankInfoAsync(id, userId, body, HttpContext.RequestAborted);
            return Ok(new { message = "Đã cập nhật thông tin nhận hoàn tiền." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("upload-refund-qr")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadRefundQr(IFormFile file)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng tải ảnh QR." });
        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File phải là ảnh." });

        try
        {
            var upload = await _fileService.UploadPaymentProofAsync(file, userId, HttpContext.RequestAborted);
            return Ok(new { url = upload.SecureUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Upload thất bại: " + ex.Message });
        }
    }

    [HttpGet("{id:guid}/payment-context")]
    public async Task<IActionResult> GetPaymentContext([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var ctx = await _bookingService.GetPaymentContextAsync(id, userId, HttpContext.RequestAborted);
            return Ok(ctx);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/payment")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> SubmitPayment([FromRoute] Guid id, [FromForm] SubmitBookingPaymentForm form)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (form?.ProofImage == null || form.ProofImage.Length == 0)
            return BadRequest(new { message = "Vui lòng tải ảnh minh chứng." });
        if (!form.ProofImage.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File phải là ảnh." });

        try
        {
            var upload = await _fileService.UploadPaymentProofAsync(form.ProofImage, id, HttpContext.RequestAborted);
            await _bookingService.SubmitPaymentAsync(id, userId, form.Method, upload.SecureUrl, HttpContext.RequestAborted);
            return Ok(new { message = "Đã gửi minh chứng thanh toán. Vui lòng chờ chủ sân xác nhận." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message }); }
    }

    [HttpPost("preview-discount")]
    public async Task<IActionResult> PreviewDiscount([FromBody] PreviewDiscountDto dto)
    {
        if (dto.BaseAmount <= 0)
            return BadRequest(new { message = "BaseAmount phải lớn hơn 0." });

        _ = TryGetCurrentUserId(out var previewUserId);
        var uid = previewUserId == Guid.Empty ? (Guid?)null : previewUserId;

        try
        {
            var result = await _bookingService.PreviewDiscountAsync(dto, uid, HttpContext.RequestAborted);
            if (result.ErrorMsg == "Venue not found")
                return BadRequest(new { message = "Cơ sở không tồn tại." });

            return Ok(new
            {
                baseAmount = result.BaseAmount,
                discountAmount = result.DiscountAmount,
                longTermDiscountAmount = result.LongTermDiscountAmount,
                couponDiscountAmount = result.CouponDiscountAmount,
                finalAmount = result.FinalAmount,
                isValidCoupon = result.IsValidCoupon,
                errorMsg = result.ErrorMsg,
            });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/remind-owner")]
    public async Task<IActionResult> RemindOwner([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var cooldownMinutes = _configuration.GetValue("ReminderSettings:SoftReminderCooldownMinutes", 60);

        try
        {
            var result = await _bookingService.RemindOwnerAsync(id, userId, cooldownMinutes, HttpContext.RequestAborted);
            return Ok(new { message = result.Message });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex)
        {
            return StatusCode(429, new { message = ex.Message });
        }
    }
}

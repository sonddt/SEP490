using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend;
using ShuttleUp.Backend.BookingForms;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public partial class BookingsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IFileService _fileService;
    private readonly IOptions<VnpayOptions> _vnpayOptions;
    private readonly IConfiguration _configuration;

    public BookingsController(
        ShuttleUpDbContext dbContext,
        IFileService fileService,
        IOptions<VnpayOptions> vnpayOptions,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _fileService = fileService;
        _vnpayOptions = vnpayOptions;
        _configuration = configuration;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    private static bool IsWeekendDate(DateTime d) =>
        d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    private static CancellationPolicySnapshot ParsePolicyOrDefault(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new CancellationPolicySnapshot();
        try
        {
            return JsonSerializer.Deserialize<CancellationPolicySnapshot>(json) ?? new CancellationPolicySnapshot();
        }
        catch
        {
            return new CancellationPolicySnapshot();
        }
    }

    private static DateTime ToUtcComparable(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };
    }

    /// <summary>
    /// Giá một khung 30 phút theo bảng giá sân (price = tiền / 30 phút trong khoảng giờ đó).
    /// </summary>
    private static decimal? ResolveSlotPrice(IReadOnlyCollection<CourtPrice> prices, DateTime slotStart)
    {
        var weekend = IsWeekendDate(slotStart);
        var t = TimeOnly.FromDateTime(slotStart);
        foreach (var p in prices.OrderBy(x => x.StartTime))
        {
            if (p.IsWeekend != weekend || p.StartTime == null || p.EndTime == null)
                continue;
            if (t >= p.StartTime.Value && t < p.EndTime.Value)
                return p.Price;
        }

        return null;
    }

    /// <summary>
    /// Tạo đơn đặt sân + các khung giờ; kiểm tra trùng lịch server-side.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        if (string.IsNullOrWhiteSpace(dto.ContactName))
            return BadRequest(new { message = "Vui lòng nhập họ tên." });

        if (string.IsNullOrWhiteSpace(dto.ContactPhone))
            return BadRequest(new { message = "Vui lòng nhập số điện thoại." });

        if (dto.HoldId.HasValue)
            return await CreateBookingFromHoldAsync(dto, userId);

        var norm = await TryNormalizeAndLoadCourtsAsync(dto.VenueId, dto.Items);
        if (norm.Fail != null)
            return norm.Fail;

        var normalizedItems = norm.Slots!;
        var courtById = norm.Courts!;
        var courtIds = normalizedItems.Select(x => x.CourtId).Distinct().ToList();

        var venuePolicy = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.Id == dto.VenueId && v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                v.CancelAllowed,
                v.CancelBeforeMinutes,
                v.RefundType,
                v.RefundPercent,
            })
            .FirstOrDefaultAsync();

        if (venuePolicy == null)
            return BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." });

        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);

        var c1 = await TryConflictBookingsAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c1 != null)
            return c1;
        var c2 = await TryConflictBlocksAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c2 != null)
            return c2;
        var c3 = await TryConflictHoldOthersAsync(dto.VenueId, normalizedItems, courtIds, minStart, maxEnd, null);
        if (c3 != null)
            return c3;

        var total = normalizedItems.Sum(x => x.Price);

        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            Status = "PENDING",
            TotalAmount = total,
            DiscountAmount = 0,
            FinalAmount = total,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            GuestNote = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            CancellationPolicySnapshotJson = JsonSerializer.Serialize(policySnapshot),
            CreatedAt = DateTime.UtcNow
        };

        foreach (var ni in normalizedItems)
        {
            booking.BookingItems.Add(new BookingItem
            {
                Id = Guid.NewGuid(),
                CourtId = ni.CourtId,
                StartTime = ni.Start,
                EndTime = ni.End,
                FinalPrice = ni.Price,
                Status = "PENDING"
            });
        }

        await using var trx = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            _dbContext.Bookings.Add(booking);
            await _dbContext.SaveChangesAsync();
            await trx.CommitAsync();
        }
        catch
        {
            await trx.RollbackAsync();
            throw;
        }

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        var response = new BookingResponseDto
        {
            BookingId = booking.Id,
            BookingCode = code,
            Status = booking.Status,
            TotalAmount = total,
            FinalAmount = total,
            Items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = courtById.GetValueOrDefault(bi.CourtId ?? Guid.Empty)?.Name,
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList()
        };

        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>
    /// Lịch sử đặt sân của tài khoản hiện tại.
    /// </summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyBookings()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var rows = await _dbContext.Bookings
            .AsNoTracking()
            .Where(b => b.UserId == userId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.Status,
                b.ManagerStatusNote,
                b.TotalAmount,
                b.FinalAmount,
                b.CreatedAt,
                VenueName = b.Venue != null ? b.Venue.Name : null,
                VenueAddress = b.Venue != null ? b.Venue.Address : null,
                b.VenueId,
                LastPaymentMethod = b.Payments
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => p.Method)
                    .FirstOrDefault(),
                HasValidPaymentProof = b.Payments.Any(p =>
                    (p.GatewayReference != null && p.GatewayReference.StartsWith("https"))
                    || (p.Method != null && p.Method.Equals("VNPAY", StringComparison.OrdinalIgnoreCase)
                        && p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))),
                Items = b.BookingItems.Select(bi => new
                {
                    bi.Id,
                    bi.CourtId,
                    CourtName = bi.Court != null ? bi.Court.Name : null,
                    bi.StartTime,
                    bi.EndTime,
                    bi.FinalPrice,
                    bi.Status
                })
            })
            .ToListAsync();

        var withCode = rows.Select(b => new
        {
            b.Id,
            bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant(),
            b.Status,
            b.ManagerStatusNote,
            b.TotalAmount,
            b.FinalAmount,
            b.CreatedAt,
            b.VenueName,
            b.VenueAddress,
            b.VenueId,
            lastPaymentMethod = b.LastPaymentMethod,
            hasValidPaymentProof = b.HasValidPaymentProof,
            needsPaymentRetry = b.Status == "PENDING" && !b.HasValidPaymentProof,
            b.Items
        });

        return Ok(withCode);
    }

    /// <summary>
    /// Người chơi tự huỷ đơn (chờ duyệt hoặc đã được xác nhận).
    /// </summary>
    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> CancelMyBooking([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status == "CANCELLED")
            return BadRequest(new { message = "Đơn đã bị huỷ trước đó." });

        if (booking.Status is not ("PENDING" or "CONFIRMED"))
            return BadRequest(new { message = "Không thể huỷ đơn ở trạng thái này." });

        var policy = ParsePolicyOrDefault(booking.CancellationPolicySnapshotJson);
        if (!policy.AllowCancel)
            return BadRequest(new { message = "Theo chính sách cụm sân, bạn không thể tự huỷ đơn này. Vui lòng liên hệ chủ sân." });

        var starts = booking.BookingItems
            .Where(bi => bi.StartTime != null)
            .Select(bi => bi.StartTime!.Value)
            .ToList();
        if (starts.Count > 0)
        {
            var minStartUtc = starts.Select(ToUtcComparable).Min();
            var deadlineUtc = minStartUtc.AddMinutes(-policy.CancelBeforeMinutes);
            if (DateTime.UtcNow > deadlineUtc)
            {
                return BadRequest(new
                {
                    message = $"Đã quá thời hạn huỷ (phải huỷ trước giờ đá ít nhất {policy.CancelBeforeMinutes} phút, theo chính sách lúc đặt).",
                });
            }
        }

        booking.Status = "CANCELLED";
        foreach (var item in booking.BookingItems)
            item.Status = "CANCELLED";

        foreach (var p in booking.Payments.Where(p =>
                     p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            p.Status = "CANCELLED";

        await _dbContext.SaveChangesAsync();

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        var pol = ParsePolicyOrDefault(booking.CancellationPolicySnapshotJson);
        var refundHint = pol.RefundType switch
        {
            "FULL" => "Theo chính sách lúc đặt: có thể hoàn tiền (thủ công qua chủ sân).",
            "PERCENT" when pol.RefundPercent.HasValue => $"Theo chính sách lúc đặt: có thể hoàn khoảng {pol.RefundPercent}% (thủ công qua chủ sân).",
            _ => "Theo chính sách lúc đặt: không hoàn tiền tự động. Liên hệ chủ sân nếu cần.",
        };
        return Ok(new
        {
            message = "Đã huỷ đặt sân thành công.",
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status,
            refundHint,
        });
    }

    /// <summary>
    /// Lấy dữ liệu để hiển thị bước thanh toán lại / tiếp tục thanh toán.
    /// </summary>
    [HttpGet("{id:guid}/payment-context")]
    public async Task<IActionResult> GetPaymentContext([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .Include(b => b.Venue)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status != "PENDING")
            return BadRequest(new { message = "Chỉ có thể thanh toán khi đơn đang chờ duyệt." });

        var lastPay = booking.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
        var hasProof = lastPay != null
                       && ((!string.IsNullOrEmpty(lastPay.GatewayReference)
                            && lastPay.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase))
                           || (lastPay.Method != null && lastPay.Method.Equals("VNPAY", StringComparison.OrdinalIgnoreCase)
                               && lastPay.Status != null
                               && lastPay.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase)));

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        var items = booking.BookingItems
            .OrderBy(bi => bi.StartTime)
            .Select(bi => new
            {
                courtId = bi.CourtId,
                courtName = bi.Court != null ? bi.Court.Name : null,
                startTime = bi.StartTime,
                endTime = bi.EndTime,
                price = bi.FinalPrice ?? 0,
            })
            .ToList();

        var totalMins = booking.BookingItems.Count * 30;
        var th = totalMins / 60;
        var tm = totalMins % 60;
        var totalHoursStr = tm > 0 ? $"{th}h{tm}" : $"{th}h";

        return Ok(new
        {
            bookingId = booking.Id,
            bookingCode = code,
            venueId = booking.VenueId,
            venueName = booking.Venue != null ? booking.Venue.Name : null,
            venueAddress = booking.Venue != null ? booking.Venue.Address : null,
            date = booking.BookingItems.Min(bi => bi.StartTime)?.ToString("yyyy-MM-dd"),
            totalPrice = booking.FinalAmount ?? 0,
            totalHours = totalHoursStr,
            customerName = booking.ContactName,
            customerPhone = booking.ContactPhone,
            note = booking.GuestNote,
            hasValidPaymentProof = hasProof,
            selectedSlots = items,
        });
    }

    /// <summary>
    /// Gửi minh chứng thanh toán (ảnh) + phương thức; ảnh lưu Cloudinary.
    /// </summary>
    [HttpPost("{id:guid}/payment")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> SubmitPayment(
        [FromRoute] Guid id,
        [FromForm] SubmitBookingPaymentForm form)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        if (form?.ProofImage == null || form.ProofImage.Length == 0)
            return BadRequest(new { message = "Vui lòng tải ảnh minh chứng." });

        var proofImage = form.ProofImage;
        if (!proofImage.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File phải là ảnh." });

        var booking = await _dbContext.Bookings
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status == "CANCELLED")
            return BadRequest(new { message = "Đơn đã bị huỷ." });

        if (booking.Status != "PENDING")
            return BadRequest(new { message = "Chỉ có thể nộp minh chứng khi đơn đang chờ duyệt." });

        var methodNorm = string.IsNullOrWhiteSpace(form.Method) ? "BANK" : form.Method.Trim().ToUpperInvariant();
        var methodLabel = methodNorm == "QR" ? "QR" : "BANK_TRANSFER";

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadPaymentProofAsync(proofImage, id, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
        }

        var existingPending = booking.Payments
            .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        if (existingPending != null
            && existingPending.Method != null
            && existingPending.Method.Equals("VNPAY", StringComparison.OrdinalIgnoreCase)
            && (existingPending.Status == null || existingPending.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { message = "Bạn đã chọn thanh toán VNPay. Vui lòng hoàn tất trên cổng VNPay hoặc đợi kết quả giao dịch." });
        }

        if (existingPending != null
            && !string.IsNullOrEmpty(existingPending.GatewayReference)
            && existingPending.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Đơn đã có minh chứng thanh toán. Không gửi lại." });
        }

        Payment paymentRow;
        if (existingPending != null)
        {
            existingPending.Method = methodLabel;
            existingPending.GatewayReference = secureUrl;
            existingPending.Amount = booking.FinalAmount;
            existingPending.CreatedAt = DateTime.UtcNow;
            paymentRow = existingPending;
        }
        else
        {
            paymentRow = new Payment
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                Method = methodLabel,
                Status = "PENDING",
                Amount = booking.FinalAmount,
                GatewayReference = secureUrl,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Payments.Add(paymentRow);
        }

        await _dbContext.SaveChangesAsync();

        var bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        return Ok(new
        {
            paymentId = paymentRow.Id,
            paymentRow.Status,
            paymentRow.Method,
            paymentRow.Amount,
            proofUrl = secureUrl,
            bookingId = booking.Id,
            bookingCode
        });
    }
}

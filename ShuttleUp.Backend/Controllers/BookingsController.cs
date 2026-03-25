using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend.BookingForms;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IFileService _fileService;

    public BookingsController(ShuttleUpDbContext dbContext, IFileService fileService)
    {
        _dbContext = dbContext;
        _fileService = fileService;
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

        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "Vui lòng chọn ít nhất một khung giờ." });

        if (string.IsNullOrWhiteSpace(dto.ContactName))
            return BadRequest(new { message = "Vui lòng nhập họ tên." });

        if (string.IsNullOrWhiteSpace(dto.ContactPhone))
            return BadRequest(new { message = "Vui lòng nhập số điện thoại." });

        var venue = await _dbContext.Venues
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == dto.VenueId
                                       && v.IsActive == true);

        if (venue == null)
            return BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." });

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync();

        if (courts.Count != courtIds.Count)
            return BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." });

        var courtById = courts.ToDictionary(c => c.Id);

        var normalizedItems = new List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>();
        foreach (var item in dto.Items)
        {
            if (item.EndTime <= item.StartTime)
                return BadRequest(new { message = "Khung giờ không hợp lệ (end phải sau start)." });

            if (!courtById.TryGetValue(item.CourtId, out var court))
                return BadRequest(new { message = "Sân không hợp lệ." });

            for (var slotStart = item.StartTime; slotStart < item.EndTime; slotStart = slotStart.AddMinutes(30))
            {
                var slotEnd = slotStart.AddMinutes(30);
                if (slotEnd > item.EndTime)
                    return BadRequest(new { message = "Mỗi khung phải là bội số 30 phút." });

                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slotStart);
                if (price == null)
                    return BadRequest(new { message = $"Chưa cấu hình giá cho sân {court.Name} tại {slotStart:HH:mm}." });

                normalizedItems.Add((item.CourtId, slotStart, slotEnd, price.Value));
            }
        }

        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);

        var existingItems = await _dbContext.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && courtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null && bi.Booking.Status != "CANCELLED")
            .ToListAsync();

        foreach (var bi in existingItems)
        {
            foreach (var ni in normalizedItems)
            {
                if (ni.CourtId != bi.CourtId || bi.StartTime == null || bi.EndTime == null)
                    continue;
                if (bi.StartTime < ni.End && bi.EndTime > ni.Start)
                    return Conflict(new { message = "Một hoặc nhiều khung giờ vừa được người khác đặt. Vui lòng chọn lại." });
            }
        }

        var blocks = await _dbContext.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && courtIds.Contains(b.CourtId.Value)
                                            && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync();

        foreach (var b in blocks)
        {
            foreach (var ni in normalizedItems)
            {
                if (ni.CourtId != b.CourtId || b.StartTime == null || b.EndTime == null)
                    continue;
                if (b.StartTime < ni.End && b.EndTime > ni.Start)
                    return Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." });
            }
        }

        var total = normalizedItems.Sum(x => x.Price);

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
            CreatedAt = DateTime.UtcNow
        };

        foreach (var ni in normalizedItems)
        {
            if (!courtById.TryGetValue(ni.CourtId, out var court))
                continue;

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

        booking.Status = "CANCELLED";
        foreach (var item in booking.BookingItems)
            item.Status = "CANCELLED";

        foreach (var p in booking.Payments.Where(p =>
                     p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            p.Status = "CANCELLED";

        await _dbContext.SaveChangesAsync();

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        return Ok(new
        {
            message = "Đã huỷ đặt sân thành công.",
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status
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
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status == "CANCELLED")
            return BadRequest(new { message = "Đơn đã bị huỷ." });

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

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            BookingId = booking.Id,
            Method = methodLabel,
            Status = "PENDING",
            Amount = booking.FinalAmount,
            GatewayReference = secureUrl,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        return Ok(new
        {
            payment.Id,
            payment.Status,
            payment.Method,
            payment.Amount,
            proofUrl = secureUrl,
            bookingId = booking.Id,
            bookingCode
        });
    }
}

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Public/player-facing APIs for browsing venues.
/// Chỉ trả về các venue đã được admin duyệt và đang hoạt động.
/// </summary>
[ApiController]
[Route("api/venues")]
public class VenuesController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;

    public VenuesController(ShuttleUpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Lấy chi tiết một venue (dùng cho trang VenueDetails).
    /// Chỉ trả về nếu venue đã APPROVED và đang hoạt động.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVenueById([FromRoute] Guid id)
    {
        var raw = await _dbContext.Venues
            .Where(v => v.Id == id && v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.Lat,
                v.Lng,
                v.WeeklyDiscountPercent,
                v.MonthlyDiscountPercent,
                v.Description,
                v.Includes,
                v.Rules,
                v.Amenities,
                v.SlotDuration,
                OwnerName = v.OwnerUser != null ? v.OwnerUser.FullName : null,
                OwnerEmail = v.OwnerUser != null ? v.OwnerUser.Email : null,
                OwnerPhone = v.OwnerUser != null ? v.OwnerUser.PhoneNumber : null,
                MinPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Min(cp => (decimal?)cp.Price),
                MaxPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Max(cp => (decimal?)cp.Price),
                Rating = v.VenueReviews.Any()
                    ? v.VenueReviews.Average(r => (double?)r.Stars) ?? 0.0
                    : 0.0,
                ReviewCount = v.VenueReviews.Count()
            })
            .FirstOrDefaultAsync();

        if (raw == null)
            return NotFound();

        // Deserialize JSON columns thành List<string> để frontend nhận được array thật
        static List<string>? ParseJsonArray(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<string>>(json); }
            catch { return null; }
        }

        return Ok(new
        {
            raw.Id,
            raw.Name,
            raw.Address,
            raw.Lat,
            raw.Lng,
            raw.WeeklyDiscountPercent,
            raw.MonthlyDiscountPercent,
            raw.Description,
            Includes = ParseJsonArray(raw.Includes),
            Rules = ParseJsonArray(raw.Rules),
            Amenities = ParseJsonArray(raw.Amenities),
            raw.SlotDuration,
            raw.OwnerName,
            raw.OwnerEmail,
            raw.OwnerPhone,
            raw.MinPrice,
            raw.MaxPrice,
            raw.Rating,
            raw.ReviewCount,
        });
    }

    /// <summary>
    /// Danh sách venues cho player.
    /// Chỉ bao gồm venues APPROVED + IsActive = true.
    /// Hỗ trợ sort theo giá min tăng dần / giảm dần.
    /// </summary>
    /// <param name="sortBy">Trường sắp xếp: price (mặc định: price).</param>
    /// <param name="sortDir">Hướng sắp xếp: asc | desc (mặc định: asc).</param>
    [HttpGet]
    public async Task<IActionResult> GetApprovedVenues(
        [FromQuery] string? sortBy = "price",
        [FromQuery] string? sortDir = "asc")
    {
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "price" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();

        // Lấy venues đang hoạt động cùng với min/max price (nếu có)
        var baseQuery = _dbContext.Venues
            .Where(v => v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.Lat,
                v.Lng,
                v.CreatedAt,
                v.OwnerUserId,
                OwnerName = v.OwnerUser == null
                    ? null
                    : (string.IsNullOrWhiteSpace(v.OwnerUser.FullName)
                        ? v.OwnerUser.Email
                        : v.OwnerUser.FullName),
                OwnerAvatarUrl = v.OwnerUser != null && v.OwnerUser.AvatarFile != null
                    ? v.OwnerUser.AvatarFile.FileUrl
                    : null,
                AmenitiesJson = v.Amenities,
                Rating = v.VenueReviews.Any()
                    ? v.VenueReviews.Average(r => (double?)r.Stars) ?? 0.0
                    : 0.0,
                ReviewCount = v.VenueReviews.Count(),
                // Giá thấp nhất và cao nhất trong tất cả court thuộc venue (cả weekday & weekend)
                MinPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Min(cp => (decimal?)cp.Price), // null nếu chưa cấu hình giá
                MaxPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Max(cp => (decimal?)cp.Price)
            });

        // Giữ IQueryable cùng anonymous type — không dùng IQueryable<dynamic> (dễ khiến materialize sai, mất OwnerName).
        var ordered = sortBy == "price"
            ? (sortDir == "desc"
                ? baseQuery.OrderByDescending(v => v.MinPrice.HasValue)
                    .ThenByDescending(v => v.MinPrice)
                : baseQuery.OrderByDescending(v => v.MinPrice.HasValue)
                    .ThenBy(v => v.MinPrice))
            : (sortDir == "desc"
                ? baseQuery.OrderByDescending(v => v.Name)
                : baseQuery.OrderBy(v => v.Name));

        var items = await ordered.AsNoTracking().ToListAsync();

        // Deserialize JSON columns thành List<string> để frontend nhận được array thật
        static List<string>? ParseJsonArray(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<string>>(json); }
            catch { return null; }
        }

        return Ok(items.Select(v => new
        {
            v.Id,
            v.Name,
            v.Address,
            v.Lat,
            v.Lng,
            v.CreatedAt,
            v.OwnerUserId,
            v.OwnerName,
            v.OwnerAvatarUrl,
            Amenities = ParseJsonArray(v.AmenitiesJson),
            v.Rating,
            v.ReviewCount,
            v.MinPrice,
            v.MaxPrice,
        }));
    }

    /// <summary>
    /// Danh sách sân đang hoạt động + bảng giá (đặt lịch).
    /// </summary>
    [HttpGet("{id:guid}/courts")]
    public async Task<IActionResult> GetVenueCourts([FromRoute] Guid id)
    {
        var exists = await _dbContext.Venues.AnyAsync(v =>
            v.Id == id && v.IsActive == true);

        if (!exists)
            return NotFound();

        var courts = await _dbContext.Courts
            .AsNoTracking()
            .Where(c => c.VenueId == id && c.IsActive == true && c.Status == "ACTIVE")
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                Prices = c.CourtPrices
                    .OrderBy(p => p.StartTime)
                    .Select(p => new
                    {
                        p.StartTime,
                        p.EndTime,
                        p.Price,
                        p.IsWeekend
                    })
            })
            .ToListAsync();

        return Ok(courts);
    }

    /// <summary>
    /// Khung giờ đã đặt / bị khóa trong một ngày (YYYY-MM-DD), theo từng sân.
    /// </summary>
    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> GetVenueAvailability([FromRoute] Guid id, [FromQuery] string date)
    {
        var exists = await _dbContext.Venues.AnyAsync(v =>
            v.Id == id && v.IsActive == true);

        if (!exists)
            return NotFound();

        if (!DateOnly.TryParse(date, out var day))
            return BadRequest(new { message = "Tham số date phải là YYYY-MM-DD." });

        var dayStart = day.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var userIdClaim = User.Identity?.IsAuthenticated == true
            ? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            : null;
        Guid? currentUserGuid = null;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var parsedUserId))
            currentUserGuid = parsedUserId;

        var bookedQuery = _dbContext.BookingItems
            .AsNoTracking()
            .Where(bi => bi.Court != null && bi.Court.VenueId == id
                                              && bi.StartTime < dayEnd && bi.EndTime > dayStart
                                              && bi.Booking != null && bi.Booking.Status != "CANCELLED");

        var now = DateTime.UtcNow;

        if (currentUserGuid != null)
        {
            var me = currentUserGuid.Value;
            bookedQuery = bookedQuery.Where(bi =>
                bi.Booking!.Status != "HOLDING" ||
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now && bi.Booking.UserId != me)
            );
        }
        else 
        {
            bookedQuery = bookedQuery.Where(bi => 
                bi.Booking!.Status != "HOLDING" || 
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now)
            );
        }

        var booked = await bookedQuery
            .Select(bi => new
            {
                CourtId = bi.CourtId!.Value,
                bi.StartTime,
                bi.EndTime,
                Kind = "booked"
            })
            .ToListAsync();

        var blocked = await _dbContext.CourtBlocks
            .AsNoTracking()
            .Where(b => b.Court != null && b.Court.VenueId == id
                                         && b.StartTime < dayEnd && b.EndTime > dayStart)
            .Select(b => new
            {
                CourtId = b.CourtId!.Value,
                b.StartTime,
                b.EndTime,
                Kind = "blocked",
                b.ReasonCode,
                b.ReasonDetail,
            })
            .ToListAsync();

        var courtIds = await _dbContext.Courts
            .AsNoTracking()
            .Where(c => c.VenueId == id && c.IsActive == true && c.Status == "ACTIVE")
            .Select(c => c.Id)
            .ToListAsync();

        var intervalsByCourt = courtIds.ToDictionary(cid => cid, _ => new List<object>());

        foreach (var row in booked)
        {
            if (intervalsByCourt.TryGetValue(row.CourtId, out var list))
                list.Add(new { start = row.StartTime, end = row.EndTime, kind = row.Kind });
        }

        foreach (var row in blocked)
        {
            if (intervalsByCourt.TryGetValue(row.CourtId, out var list))
                list.Add(new
                {
                    start = row.StartTime,
                    end = row.EndTime,
                    kind = row.Kind,
                    reasonCode = row.ReasonCode,
                    reasonDetail = row.ReasonDetail,
                });
        }

        var payload = intervalsByCourt.Select(kv => new
        {
            courtId = kv.Key,
            intervals = kv.Value
        });

        return Ok(payload);
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
        var v = await _dbContext.Venues
            .AsNoTracking()
            .Where(venue => venue.Id == id && venue.IsActive == true)
            .Select(venue => new
            {
                venue.Id,
                venue.Name,
                venue.PaymentBankName,
                venue.PaymentBankBin,
                venue.PaymentAccountNumber,
                venue.PaymentAccountHolder,
                venue.PaymentTransferNoteTemplate,
                venue.PaymentNote,
                venue.VenueRules,
                venue.CancelAllowed,
                venue.CancelBeforeMinutes,
                venue.RefundType,
                venue.RefundPercent,
            })
            .FirstOrDefaultAsync();

        if (v == null)
            return NotFound();

        var bin = VietQrHelper.ResolveBin(v.PaymentBankBin, v.PaymentBankName);
        var amt = amount ?? 0m;
        var note = string.IsNullOrWhiteSpace(addInfo) ? null : addInfo.Trim();
        var vietQrUrl = VietQrHelper.BuildQrImageUrl(bin, v.PaymentAccountNumber, amt, note);

        return Ok(new
        {
            venueId = v.Id,
            venueName = v.Name,
            bankName = v.PaymentBankName,
            bankBin = bin,
            accountNumber = v.PaymentAccountNumber,
            accountHolder = v.PaymentAccountHolder,
            transferNoteTemplate = v.PaymentTransferNoteTemplate ?? "[SĐT] - [Tên sân] - [Ngày]",
            paymentNote = v.PaymentNote,
            venueRules = v.VenueRules,
            vietQrImageUrl = vietQrUrl,
            cancellation = new
            {
                allowCancel = v.CancelAllowed,
                cancelBeforeMinutes = v.CancelBeforeMinutes,
                refundType = v.RefundType ?? "NONE",
                refundPercent = v.RefundPercent,
            },
        });
    }
}


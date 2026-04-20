using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Thống kê doanh thu và tổng quan cho Manager.
/// Routes: /api/manager/stats/...
/// </summary>
[ApiController]
[Route("api/manager/stats")]
[Authorize(Roles = "MANAGER")]
public class ManagerStatsController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;

    public ManagerStatsController(ShuttleUpDbContext db)
    {
        _db = db;
    }

    // =========================================================================
    // GET /api/manager/stats/overview
    // Tổng quan: số sân, booking hôm nay/tháng, doanh thu, top 5 sân
    // =========================================================================

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        // Use Vietnam day/month boundaries (UTC+7)
        var vnTz = GetVietnamTimeZone();
        var nowUtc = DateTime.UtcNow;
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTz);

        var vnStartOfDay = DateTime.SpecifyKind(nowVn.Date, DateTimeKind.Unspecified);
        var startOfDayUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfDay, vnTz);

        var vnStartOfMonth = DateTime.SpecifyKind(new DateTime(nowVn.Year, nowVn.Month, 1, 0, 0, 0), DateTimeKind.Unspecified);
        var startOfMonthUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfMonth, vnTz);
        var paidStatuses  = new[] { "CONFIRMED", "COMPLETED" };

        // Danh sách venue của manager
        var venueIds = await _db.Venues
            .Where(v => v.OwnerUserId == managerId)
            .Select(v => v.Id)
            .ToListAsync();

        var totalVenues  = venueIds.Count;
        var totalCourts  = await _db.Courts.CountAsync(c => c.VenueId.HasValue && venueIds.Contains(c.VenueId.Value));
        var activeCourts = await _db.Courts.CountAsync(c => c.VenueId.HasValue && venueIds.Contains(c.VenueId.Value) && c.IsActive == true);

        var venueIdList  = venueIds.ToList();
        var bookingsBase = _db.Bookings.Where(b => b.VenueId.HasValue && venueIdList.Contains(b.VenueId.Value));

        var todayBookings  = await bookingsBase.CountAsync(b => b.CreatedAt >= startOfDayUtc);
        var monthBookings  = await bookingsBase.CountAsync(b => b.CreatedAt >= startOfMonthUtc);
        var pendingCount   = await bookingsBase.CountAsync(b => b.Status == "PENDING");

        var paidBase       = bookingsBase.Where(b => paidStatuses.Contains(b.Status));
        var monthRevenue   = await paidBase.Where(b => b.CreatedAt >= startOfMonthUtc).SumAsync(b => b.TotalAmount ?? 0);
        var totalRevenue   = await paidBase.SumAsync(b => b.TotalAmount ?? 0);

        // Top 5 sân doanh thu tháng này
        var topVenues = await _db.Venues
            .Where(v => venueIds.Contains(v.Id))
            .Select(v => new
            {
                v.Id,
                v.Name,
                monthRev = v.Bookings
                    .Where(b => paidStatuses.Contains(b.Status) && b.CreatedAt >= startOfMonthUtc)
                    .Sum(b => b.TotalAmount ?? 0),
                monthCount = v.Bookings.Count(b => b.CreatedAt >= startOfMonthUtc),
            })
            .OrderByDescending(v => v.monthRev)
            .Take(5)
            .ToListAsync();

        // 5 booking gần nhất
        var recentBookings = await _db.Bookings
            .Where(b => b.VenueId.HasValue && venueIdList.Contains(b.VenueId.Value))
            .Include(b => b.User)
            .Include(b => b.Venue)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .OrderByDescending(b => b.CreatedAt)
            .Take(5)
            .Select(b => new
            {
                b.Id,
                player      = b.User != null ? b.User.FullName : "N/A",
                venue       = b.Venue != null ? b.Venue.Name : "N/A",
                court       = string.Join(", ", b.BookingItems.Select(bi => bi.Court != null ? bi.Court.Name : "")),
                date        = b.CreatedAt != null ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(b.CreatedAt.Value, DateTimeKind.Utc), vnTz).ToString("dd/MM/yyyy") : "",
                startTime   = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi => bi.StartTime).FirstOrDefault(),
                endTime     = b.BookingItems.OrderByDescending(bi => bi.EndTime).Select(bi => bi.EndTime).FirstOrDefault(),
                amount      = b.TotalAmount ?? 0m,
                b.Status
            })
            .ToListAsync();

        return Ok(new
        {
            totalVenues,
            totalCourts,
            activeCourts,
            todayBookings,
            monthBookings,
            pendingCount,
            monthRevenue,
            totalRevenue,
            topVenues,
            recentBookings
        });
    }

    // =========================================================================
    // GET /api/manager/stats/earnings
    // Lịch sử giao dịch với filter (venueId, startDate, endDate, status, search)
    // =========================================================================

    [HttpGet("earnings")]
    public async Task<IActionResult> GetEarnings(
        [FromQuery] Guid? venueId,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 20)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        // VN timezone boundaries for filtering & summaries
        var vnTz = GetVietnamTimeZone();

        // Venue IDs thuộc manager
        var venueIds = await _db.Venues
            .Where(v => v.OwnerUserId == managerId)
            .Select(v => new { v.Id, v.Name })
            .ToListAsync();

        // Validate venueId belongs to this manager
        if (venueId.HasValue && !venueIds.Any(v => v.Id == venueId.Value))
            return Forbid();

        var targetIds = venueId.HasValue
            ? new List<Guid> { venueId.Value }
            : venueIds.Select(v => v.Id).ToList();

        var query = _db.Bookings
            .Where(b => b.VenueId.HasValue && targetIds.Contains(b.VenueId.Value))
            .Include(b => b.User)
            .Include(b => b.Venue)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .AsNoTracking()
            .AsQueryable();

        // Status filter
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(b => b.Status == s);
        }

        // Date range
        // Interpret yyyy-MM-dd as Vietnam local day boundaries (UTC+7), then compare in UTC.
        if (!string.IsNullOrWhiteSpace(startDate) &&
            DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var dsLocal))
        {
            var vnStart = DateTime.SpecifyKind(dsLocal.Date, DateTimeKind.Unspecified);
            var utcStart = TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
            query = query.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value >= utcStart);
        }

        if (!string.IsNullOrWhiteSpace(endDate) &&
            DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var deLocal))
        {
            var vnEndExclusive = DateTime.SpecifyKind(deLocal.Date.AddDays(1), DateTimeKind.Unspecified);
            var utcEndExclusive = TimeZoneInfo.ConvertTimeToUtc(vnEndExclusive, vnTz);
            query = query.Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value < utcEndExclusive);
        }

        // Search player / court
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            query = query.Where(b =>
                (b.User != null && b.User.FullName.Contains(kw)) ||
                b.BookingItems.Any(bi => bi.Court != null && bi.Court.Name.Contains(kw)));
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var paidStatuses = new[] { "CONFIRMED", "COMPLETED" };
        var totalRevInRange = await query
            .Where(b => paidStatuses.Contains(b.Status))
            .SumAsync(b => b.TotalAmount ?? 0);

        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new
            {
                id          = b.Id,
                refId       = "BK" + b.Id.ToString().Substring(0, 6).ToUpper(),
                player      = b.User != null ? b.User.FullName : "N/A",
                venue       = b.Venue != null ? b.Venue.Name : "N/A",
                venueId     = b.VenueId,
                court       = string.Join(", ", b.BookingItems.Select(bi => bi.Court != null ? bi.Court.Name : "")),
                date        = b.CreatedAt != null ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(b.CreatedAt.Value, DateTimeKind.Utc), vnTz).ToString("dd/MM/yyyy") : "",
                dateIso     = b.CreatedAt,
                startTime   = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi => bi.StartTime).FirstOrDefault(),
                endTime     = b.BookingItems.OrderByDescending(bi => bi.EndTime).Select(bi => bi.EndTime).FirstOrDefault(),
                amount      = b.TotalAmount ?? 0m,
                status      = b.Status
            })
            .ToListAsync();

        return Ok(new
        {
            totalItems,
            totalPages,
            page,
            pageSize,
            totalRevInRange,
            venues = venueIds.Select(v => new { v.Id, v.Name }),
            items
        });
    }

    // ── Charts: doanh thu 30 ngày gần nhất ───────────────────────────────────

    [HttpGet("chart/daily")]
    public async Task<IActionResult> GetDailyChart([FromQuery] Guid? venueId, [FromQuery] int days = 30)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        if (days <= 0 || days > 365) days = 30;

        var venueIds = await _db.Venues
            .Where(v => v.OwnerUserId == managerId)
            .Select(v => v.Id)
            .ToListAsync();

        if (venueId.HasValue && !venueIds.Contains(venueId.Value)) return Forbid();
        var targetIds = venueId.HasValue ? new List<Guid> { venueId.Value } : venueIds.ToList();

        var paidStatuses = new[] { "CONFIRMED", "COMPLETED" };

        // Build VN-local day series, convert boundaries to UTC for query and group by VN date.
        var vnTz = GetVietnamTimeZone();
        var nowUtc = DateTime.UtcNow;
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTz);
        var vnSinceDate = nowVn.Date.AddDays(-(days - 1));
        var vnSinceStart = DateTime.SpecifyKind(vnSinceDate, DateTimeKind.Unspecified);
        var sinceUtc = TimeZoneInfo.ConvertTimeToUtc(vnSinceStart, vnTz);

        var raw = await _db.Bookings
            .Where(b => b.VenueId.HasValue && targetIds.Contains(b.VenueId.Value)
                     && paidStatuses.Contains(b.Status)
                     && b.CreatedAt >= sinceUtc)
            .Select(b => new { b.CreatedAt, b.TotalAmount })
            .ToListAsync();

        // Build day-by-day series
        var result = Enumerable.Range(0, days)
            .Select(i =>
            {
                var vnDay = vnSinceDate.AddDays(i);
                var rev = raw
                    .Where(b => b.CreatedAt.HasValue && TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(b.CreatedAt.Value, DateTimeKind.Utc), vnTz).Date == vnDay)
                    .Sum(b => b.TotalAmount ?? 0);
                return new
                {
                    date    = vnDay.ToString("dd/MM"),
                    dateIso = vnDay.ToString("yyyy-MM-dd"),
                    revenue = rev
                };
            })
            .ToList();

        return Ok(result);
    }

    // =========================================================================
    // GET /api/manager/stats/earnings-analytics
    // Doanh thu theo tháng, top sân được đặt, top sân bị huỷ, phân bổ revenue
    // =========================================================================

    [HttpGet("earnings-analytics")]
    public async Task<IActionResult> GetEarningsAnalytics()
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty) return Unauthorized();

        var vnTz = GetVietnamTimeZone();
        var nowUtc = DateTime.UtcNow;
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTz);

        var venueIds = await _db.Venues
            .Where(v => v.OwnerUserId == managerId)
            .Select(v => v.Id)
            .ToListAsync();

        if (!venueIds.Any())
            return Ok(new { monthlyRevenue = new object[0], topBookedCourts = new object[0], topCancelledCourts = new object[0], revenueByVenue = new object[0] });

        var paidStatuses = new[] { "CONFIRMED", "COMPLETED" };

        // ── 1) Monthly revenue (12 tháng gần nhất) ──────────────────────────
        var vnStartOf12MonthsAgo = DateTime.SpecifyKind(
            new DateTime(nowVn.Year, nowVn.Month, 1).AddMonths(-11),
            DateTimeKind.Unspecified);
        var startOf12MonthsUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOf12MonthsAgo, vnTz);

        var bookings12m = await _db.Bookings
            .Where(b => b.VenueId.HasValue && venueIds.Contains(b.VenueId.Value)
                     && b.CreatedAt >= startOf12MonthsUtc)
            .Select(b => new { b.CreatedAt, b.TotalAmount, b.Status })
            .ToListAsync();

        var monthlyRevenue = Enumerable.Range(0, 12).Select(i =>
        {
            var monthDate = new DateTime(nowVn.Year, nowVn.Month, 1).AddMonths(-11 + i);
            var monthLabel = monthDate.ToString("MM/yyyy");

            var monthBookings = bookings12m.Where(b =>
            {
                if (!b.CreatedAt.HasValue) return false;
                var vnDate = TimeZoneInfo.ConvertTimeFromUtc(
                    DateTime.SpecifyKind(b.CreatedAt.Value, DateTimeKind.Utc), vnTz);
                return vnDate.Year == monthDate.Year && vnDate.Month == monthDate.Month;
            }).ToList();

            var revenue = monthBookings
                .Where(b => paidStatuses.Contains(b.Status))
                .Sum(b => b.TotalAmount ?? 0);
            var bookingCount = monthBookings.Count(b => b.Status != "CANCELLED");

            return new { month = monthLabel, revenue, bookingCount };
        }).ToList();

        // ── 2) Top 5 sân được đặt nhiều nhất (tháng này) ────────────────────
        var vnStartOfMonth = DateTime.SpecifyKind(
            new DateTime(nowVn.Year, nowVn.Month, 1), DateTimeKind.Unspecified);
        var startOfMonthUtc = TimeZoneInfo.ConvertTimeToUtc(vnStartOfMonth, vnTz);

        var topBookedCourts = await _db.BookingItems
            .Include(bi => bi.Court)
            .Include(bi => bi.Booking)
            .Where(bi => bi.Court != null && bi.Court.VenueId.HasValue
                      && venueIds.Contains(bi.Court.VenueId.Value)
                      && bi.Booking != null
                      && bi.Booking.CreatedAt >= startOfMonthUtc
                      && bi.Booking.Status != "CANCELLED")
            .GroupBy(bi => new { bi.CourtId, CourtName = bi.Court!.Name, VenueName = bi.Court.Venue!.Name })
            .Select(g => new
            {
                courtId = g.Key.CourtId,
                courtName = g.Key.CourtName ?? "N/A",
                venueName = g.Key.VenueName ?? "N/A",
                bookingCount = g.Select(bi => bi.BookingId).Distinct().Count(),
                revenue = g.Where(bi => paidStatuses.Contains(bi.Booking!.Status))
                           .Sum(bi => bi.FinalPrice ?? 0)
            })
            .OrderByDescending(x => x.bookingCount)
            .Take(5)
            .ToListAsync();

        // ── 3) Top 5 sân bị huỷ nhiều nhất (tháng này) ──────────────────────
        var allCourtBookings = await _db.BookingItems
            .Include(bi => bi.Court)
            .Include(bi => bi.Booking)
            .Where(bi => bi.Court != null && bi.Court.VenueId.HasValue
                      && venueIds.Contains(bi.Court.VenueId.Value)
                      && bi.Booking != null
                      && bi.Booking.CreatedAt >= startOfMonthUtc)
            .Select(bi => new
            {
                bi.CourtId,
                CourtName = bi.Court!.Name ?? "N/A",
                VenueName = bi.Court.Venue!.Name ?? "N/A",
                bi.BookingId,
                Status = bi.Booking!.Status
            })
            .ToListAsync();

        var topCancelledCourts = allCourtBookings
            .GroupBy(x => new { x.CourtId, x.CourtName, x.VenueName })
            .Select(g =>
            {
                var total = g.Select(x => x.BookingId).Distinct().Count();
                var cancelled = g.Where(x => x.Status == "CANCELLED")
                                 .Select(x => x.BookingId).Distinct().Count();
                return new
                {
                    courtId = g.Key.CourtId,
                    courtName = g.Key.CourtName,
                    venueName = g.Key.VenueName,
                    cancelCount = cancelled,
                    totalBookings = total,
                    cancelRate = total > 0 ? Math.Round(cancelled * 100.0 / total, 1) : 0
                };
            })
            .Where(x => x.cancelCount > 0)
            .OrderByDescending(x => x.cancelCount)
            .Take(5)
            .ToList();

        // ── 4) Revenue by venue (tháng này) ─────────────────────────────────
        var revenueByVenue = await _db.Venues
            .Where(v => venueIds.Contains(v.Id))
            .Select(v => new
            {
                venueId = v.Id,
                venueName = v.Name ?? "N/A",
                revenue = v.Bookings
                    .Where(b => paidStatuses.Contains(b.Status) && b.CreatedAt >= startOfMonthUtc)
                    .Sum(b => b.TotalAmount ?? 0),
                bookingCount = v.Bookings
                    .Count(b => b.Status != "CANCELLED" && b.CreatedAt >= startOfMonthUtc)
            })
            .OrderByDescending(x => x.revenue)
            .ToListAsync();

        return Ok(new
        {
            monthlyRevenue,
            topBookedCourts,
            topCancelledCourts,
            revenueByVenue
        });
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub)
                 ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
    }

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        // Windows: "SE Asia Standard Time"; Linux: "Asia/Ho_Chi_Minh"
        try { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
    }
}

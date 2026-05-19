using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend.BookingForms;
using ShuttleUp.BLL.Helpers;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Helpers;
using ShuttleUp.DAL.Models;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.Backend.Utils;
using ShuttleUp.BLL.DTOs.Policy;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IFileService _fileService;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory _scopeFactory;

    private readonly IBookingCreationService _bookingCreationService;
    private readonly IBookingValidationService _bookingValidationService;
    private readonly IBookingService _bookingService;

    public BookingsController(
        ShuttleUpDbContext dbContext,
        IFileService fileService,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle,
        IMemoryCache cache,
        IConfiguration configuration,
        IServiceScopeFactory scopeFactory,
        IBookingCreationService bookingCreationService,
        IBookingValidationService bookingValidationService,
        IBookingService bookingService)
    {
        _dbContext = dbContext;
        _fileService = fileService;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
        _cache = cache;
        _configuration = configuration;
        _scopeFactory = scopeFactory;
        _bookingCreationService = bookingCreationService;
        _bookingValidationService = bookingValidationService;
        _bookingService = bookingService;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

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
    /// Tạo đơn đặt sân + các khung giờ; kiểm tra trùng lịch server-side.
    /// </summary>
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Xem trước đặt lịch dài hạn (không ghi DB).
    /// </summary>
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
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Tạo đơn đặt lịch dài hạn (một booking, thanh toán trọn gói).
    /// </summary>
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
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Xem trước đặt lịch dài hạn linh hoạt (nhiều slot tự chọn, không ghi DB).
    /// </summary>
    [HttpPost("long-term/flexible/preview")]
    public async Task<IActionResult> PreviewLongTermFlexible([FromBody] LongTermFlexibleScheduleDto dto)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var built = await _bookingValidationService.BuildFlexibleLongTermAsync(dto, currentUserId, HttpContext.RequestAborted);
            var total = built.NormalizedItems.Sum(x => x.Price);
            var courtById = built.CourtById;

            return Ok(new
            {
                venueId = dto.VenueId,
                slotCount = built.NormalizedItems.Count,
                totalAmount = total,
                rangeStart = built.RangeStart.ToString("yyyy-MM-dd"),
                rangeEnd = built.RangeEnd.ToString("yyyy-MM-dd"),
                items = built.NormalizedItems.Select(x => new
                {
                    courtId = x.CourtId,
                    courtName = courtById.GetValueOrDefault(x.CourtId)?.Name,
                    startTime = x.Start,
                    endTime = x.End,
                    price = x.Price,
                }),
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// Tạo đơn đặt lịch dài hạn linh hoạt (một booking + booking_series type FLEXIBLE).
    /// </summary>
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
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private sealed class FlexibleLongTermBuildResult
    {
        public List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>? NormalizedItems { get; init; }
        public Dictionary<Guid, Court>? CourtById { get; init; }
        public DateOnly? RangeStart { get; init; }
        public DateOnly? RangeEnd { get; init; }
        public IActionResult? Error { get; init; }
    }

    private async Task<FlexibleLongTermBuildResult> BuildFlexibleLongTermAsync(LongTermFlexibleScheduleDto dto, CancellationToken ct)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Vui lòng chọn ít nhất một khung giờ." }) };

        var venueOk = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.Id == dto.VenueId && v.IsActive == true)
            .Select(v => new { v.Id, v.SlotDuration })
            .FirstOrDefaultAsync(ct);

        if (venueOk == null)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." }) };

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync(ct);

        if (courts.Count != courtIds.Count)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." }) };

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById, venueOk.SlotDuration);
        if (normErr != null)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = normErr }) };

        if (normalizedItems.Count > BookingSlotHelper.MaxLongTermSlots)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = $"Vượt quá số khung tối đa ({BookingSlotHelper.MaxLongTermSlots} ô × {venueOk.SlotDuration} phút)." }) };

        TryGetCurrentUserId(out var currentUserId);
        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict == "CONFLICT_BOOKING")
            return new FlexibleLongTermBuildResult { Error = Conflict(new { message = "Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch." }) };
        if (conflict == "CONFLICT_BLOCK")
            return new FlexibleLongTermBuildResult { Error = Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." }) };

        var openHoursErr = await BookingSlotHelper.CheckOpenHoursAsync(_dbContext, normalizedItems, ct);
        if (openHoursErr == "COURT_CLOSED_DAY")
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác." }) };
        if (openHoursErr == "OUTSIDE_OPEN_HOURS")
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác." }) };

        var dates = normalizedItems.Select(x => DateOnly.FromDateTime(x.Start));
        var rangeStart = dates.Min();
        var rangeEnd = dates.Max();

        return new FlexibleLongTermBuildResult
        {
            NormalizedItems = normalizedItems,
            CourtById = courtById,
            RangeStart = rangeStart,
            RangeEnd = rangeEnd,
        };
    }

    private sealed class LongTermBuildResult
    {
        public List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>? NormalizedItems { get; init; }
        public List<BookingSlotHelper.SmartAllocationItem>? SmartItems { get; init; }
        public Court? Court { get; init; }
        public DateOnly? RangeStart { get; init; }
        public DateOnly? RangeEnd { get; init; }
        public TimeOnly? SessionStart { get; init; }
        public TimeOnly? SessionEnd { get; init; }
        public IActionResult? Error { get; init; }
    }

    private async Task<LongTermBuildResult> BuildLongTermNormalizedAsync(LongTermScheduleDto dto, CancellationToken ct)
    {
        var (rs, re, st, et, parseErr) = BookingSlotHelper.ParseLongTermSchedule(dto);
        if (parseErr != null)
            return new LongTermBuildResult { Error = BadRequest(new { message = parseErr }) };

        var (dayFilter, dayErr) = BookingSlotHelper.ParseDaysOfWeek(dto.DaysOfWeek);
        if (dayErr != null)
            return new LongTermBuildResult { Error = BadRequest(new { message = dayErr }) };

        var venueInfo = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.Id == dto.VenueId && v.IsActive == true)
            .Select(v => new { v.Id, v.SlotDuration })
            .FirstOrDefaultAsync(ct);

        if (venueInfo == null)
            return new LongTermBuildResult { Error = BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." }) };

        bool useSmartAllocation = !dto.CourtId.HasValue || dto.AutoSwitchCourt;

        // ── SMART ALLOCATION PATH ──
        if (useSmartAllocation)
        {
            var allCourts = await _dbContext.Courts
                .Include(c => c.CourtPrices)
                .Where(c => c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
                .ToListAsync(ct);

            if (allCourts.Count == 0)
                return new LongTermBuildResult { Error = BadRequest(new { message = "Cơ sở chưa có sân nào hoạt động." }) };

            // Expand time slots (court-agnostic)
            List<(DateTime Start, DateTime End)> timeSlots;
            string? expandErr;

            if (dto.DailySchedules != null && dto.DailySchedules.Count > 0)
            {
                var dayTimeMap = new Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)>();
                foreach (var ds in dto.DailySchedules)
                {
                    if (ds.DayOfWeek < 0 || ds.DayOfWeek > 6)
                        return new LongTermBuildResult { Error = BadRequest(new { message = "DailySchedules chứa DayOfWeek không hợp lệ (0-6)." }) };
                    if (!TimeOnly.TryParse(ds.StartTime, out var dsStart))
                        return new LongTermBuildResult { Error = BadRequest(new { message = $"StartTime không hợp lệ cho ngày {ds.DayOfWeek}." }) };
                    if (!TimeOnly.TryParse(ds.EndTime, out var dsEnd))
                        return new LongTermBuildResult { Error = BadRequest(new { message = $"EndTime không hợp lệ cho ngày {ds.DayOfWeek}." }) };
                    dayTimeMap[(DayOfWeek)ds.DayOfWeek] = (dsStart, dsEnd);
                }
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlotsWithDailySchedules(rs, re, dayTimeMap, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
            }
            else
            {
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlots(rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
            }

            if (expandErr != null)
                return new LongTermBuildResult { Error = BadRequest(new { message = expandErr }) };

            var pricePreference = string.IsNullOrWhiteSpace(dto.PricePreference) ? "BEST" : dto.PricePreference.Trim().ToUpperInvariant();

            var (smartItems, smartErr) = await BookingSlotHelper.AllocateFlexibleLongTerm(
                _dbContext, allCourts, timeSlots, dto.CourtId, pricePreference, ct);

            if (smartErr != null && smartItems.All(x => x.IsUnavailable))
                return new LongTermBuildResult { Error = Conflict(new { message = smartErr }) };

            return new LongTermBuildResult
            {
                SmartItems = smartItems,
                RangeStart = rs,
                RangeEnd = re,
                SessionStart = st,
                SessionEnd = et,
            };
        }

        // ── LEGACY SINGLE-COURT PATH ──
        var court = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .FirstOrDefaultAsync(c => c.Id == dto.CourtId!.Value && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE", ct);

        if (court == null)
            return new LongTermBuildResult { Error = BadRequest(new { message = "Sân không thuộc cơ sở hoặc không hoạt động." }) };

        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems;
        string? legacyExpandErr;

        if (dto.DailySchedules != null && dto.DailySchedules.Count > 0)
        {
            var dayTimeMap = new Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)>();
            foreach (var ds in dto.DailySchedules)
            {
                if (ds.DayOfWeek < 0 || ds.DayOfWeek > 6)
                    return new LongTermBuildResult { Error = BadRequest(new { message = "DailySchedules chứa DayOfWeek không hợp lệ (0-6)." }) };
                if (!TimeOnly.TryParse(ds.StartTime, out var dsStart))
                    return new LongTermBuildResult { Error = BadRequest(new { message = $"StartTime không hợp lệ cho ngày {ds.DayOfWeek}." }) };
                if (!TimeOnly.TryParse(ds.EndTime, out var dsEnd))
                    return new LongTermBuildResult { Error = BadRequest(new { message = $"EndTime không hợp lệ cho ngày {ds.DayOfWeek}." }) };
                dayTimeMap[(DayOfWeek)ds.DayOfWeek] = (dsStart, dsEnd);
            }
            (normalizedItems, legacyExpandErr) = BookingSlotHelper.ExpandWeeklyLongTermWithDailySchedules(
                dto.CourtId!.Value, court, rs, re, dayTimeMap, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
        }
        else
        {
            (normalizedItems, legacyExpandErr) = BookingSlotHelper.ExpandWeeklyLongTerm(
                dto.CourtId!.Value, court, rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
        }

        if (legacyExpandErr != null)
            return new LongTermBuildResult { Error = BadRequest(new { message = legacyExpandErr }) };

        var courtIds = new List<Guid> { dto.CourtId!.Value };
        TryGetCurrentUserId(out var currentUserId);
        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict == "CONFLICT_BOOKING")
            return new LongTermBuildResult { Error = Conflict(new { message = "Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch." }) };
        if (conflict == "CONFLICT_BLOCK")
            return new LongTermBuildResult { Error = Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." }) };

        var openHoursErr = await BookingSlotHelper.CheckOpenHoursAsync(_dbContext, normalizedItems, ct);
        if (openHoursErr == "COURT_CLOSED_DAY")
            return new LongTermBuildResult { Error = BadRequest(new { message = "Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác." }) };
        if (openHoursErr == "OUTSIDE_OPEN_HOURS")
            return new LongTermBuildResult { Error = BadRequest(new { message = "Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác." }) };

        return new LongTermBuildResult
        {
            NormalizedItems = normalizedItems,
            Court = court,
            RangeStart = rs,
            RangeEnd = re,
            SessionStart = st,
            SessionEnd = et,
        };
    }

    private static int CountDistinctSessionDays(
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> items)
    {
        return items.Select(x => DateOnly.FromDateTime(x.Start)).Distinct().Count();
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
                b.SeriesId,
                isLongTerm = b.SeriesId != null,
                VenueName = b.Venue != null ? b.Venue.Name : null,
                VenueAddress = b.Venue != null ? b.Venue.Address : null,
                b.VenueId,
                LastPaymentMethod = b.Payments
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => p.Method)
                    .FirstOrDefault(),
                PaymentProofUrl = b.Payments
                    .OrderByDescending(p => p.CreatedAt)
                    .Where(p => p.GatewayReference != null && p.GatewayReference.StartsWith("https"))
                    .Select(p => p.GatewayReference)
                    .FirstOrDefault(),
                HasValidPaymentProof = b.Payments.Any(p =>
                    p.GatewayReference != null
                    && p.GatewayReference.StartsWith("https")),
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

        var bookingIds = rows.Select(r => r.Id).ToList();
        var nowUtc = DateTime.UtcNow;
        var reviewRows = await _dbContext.VenueReviews
            .AsNoTracking()
            .Where(vr => vr.UserId == userId && vr.BookingId != null && bookingIds.Contains(vr.BookingId.Value))
            .Select(vr => new { BookingId = vr.BookingId!.Value, vr.Id })
            .ToListAsync();
        var reviewByBookingId = reviewRows.ToDictionary(x => x.BookingId, x => x.Id);

        var refundMap = await _dbContext.RefundRequests
            .AsNoTracking()
            .Where(r => r.BookingId != null && bookingIds.Contains(r.BookingId.Value))
            .GroupBy(r => r.BookingId!.Value)
            .Select(g => g.OrderByDescending(r => r.RequestedAt).First())
            .ToDictionaryAsync(r => r.BookingId!.Value);

        var withCode = rows.Select(b =>
        {
            refundMap.TryGetValue(b.Id, out var refund);
            var created = b.CreatedAt ?? nowUtc;
            var windowEnd = created.AddDays(3);
            var inWindow = nowUtc <= windowEnd;
            var isConfirmed = string.Equals(b.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase);
            var venueReviewId = reviewByBookingId.TryGetValue(b.Id, out var vrId) ? vrId : (Guid?)null;
            var canReview = isConfirmed && inWindow && venueReviewId == null;
            var canEditReview = isConfirmed && inWindow && venueReviewId != null;
            return new
            {
                b.Id,
                bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant(),
                b.Status,
                b.ManagerStatusNote,
                b.TotalAmount,
                b.FinalAmount,
                b.CreatedAt,
                b.SeriesId,
                b.isLongTerm,
                b.VenueName,
                b.VenueAddress,
                b.VenueId,
                lastPaymentMethod = b.LastPaymentMethod,
                paymentProofUrl = b.PaymentProofUrl,
                hasValidPaymentProof = b.HasValidPaymentProof,
                needsPaymentRetry = b.Status == "PENDING" && !b.HasValidPaymentProof,
                b.Items,
                refundStatus = refund?.Status,
                refundAmount = refund?.RequestedAmount,
                refundBankName = refund?.RefundBankName,
                refundAccountNumber = refund?.RefundAccountNumber,
                refundAccountHolder = refund?.RefundAccountHolder,
                refundQrImageUrl = refund?.RefundQrImageUrl,
                venueReviewId,
                reviewWindowEndsAt = windowEnd,
                canReview,
                canEditReview,
            };
        });

        return Ok(withCode);
    }

    private (bool hasProof, bool paymentConfirmed, decimal paidAmount) AnalyzePaymentState(ICollection<Payment> payments)
    {
        var hasProof = payments.Any(p =>
            p.GatewayReference != null
            && p.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase));
        var paymentConfirmed = payments.Any(p =>
            p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase));
        var paidAmount = payments
            .Where(p => p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount ?? 0);
        return (hasProof, paymentConfirmed, paidAmount);
    }

    private static decimal SumPendingPaymentAmount(ICollection<Payment> payments) =>
        payments
            .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount ?? 0);

    /// <summary>
    /// Preview trước khi hủy: hiển thị chính sách, phí phạt, số tiền hoàn.
    /// </summary>
    [HttpGet("{id:guid}/cancel-preview")]
    public async Task<IActionResult> CancelPreview([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .Include(b => b.Venue)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        var policy = ParsePolicyOrDefault(booking.CancellationPolicySnapshotJson);
        var (hasProof, paymentConfirmed, paidAmount) = AnalyzePaymentState(booking.Payments);
        var pendingPaymentAmount = SumPendingPaymentAmount(booking.Payments);
        var finalAmount = booking.FinalAmount ?? booking.TotalAmount ?? 0;

        var starts = booking.BookingItems
            .Where(bi => bi.StartTime != null)
            .Select(bi => bi.StartTime!.Value)
            .ToList();
        var minStart = starts.Count > 0 ? starts.Select(ToUtcComparable).Min() : (DateTime?)null;
        var withinDeadline = minStart == null || DateTime.UtcNow <= minStart.Value.AddMinutes(-policy.CancelBeforeMinutes);

        string cancelBranch;
        if (paymentConfirmed) cancelBranch = "PAID";
        else if (hasProof) cancelBranch = "PROOF_UPLOADED";
        else cancelBranch = "NO_PAYMENT";

        decimal refundAmount = 0;
        decimal penaltyAmount = 0;
        string? refundEstimateNote = null;

        if (withinDeadline && policy.AllowCancel)
        {
            if (cancelBranch == "PAID")
            {
                refundAmount = policy.ComputeRefundAmount(paidAmount);
                penaltyAmount = paidAmount - refundAmount;
            }
            else if (cancelBranch == "PROOF_UPLOADED")
            {
                // Khớp với reconcile: sau khi chủ sân xác nhận, PENDING → COMPLETED rồi áp policy.
                refundAmount = policy.ComputeRefundAmount(pendingPaymentAmount);
                penaltyAmount = pendingPaymentAmount - refundAmount;
                refundEstimateNote =
                    "Số tiền hoàn là ước tính sau khi chủ sân xác nhận đã nhận đủ chuyển khoản (đối soát).";
            }
        }

        return Ok(new
        {
            bookingId = booking.Id,
            bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant(),
            bookingStatus = booking.Status,
            venueName = booking.Venue?.Name,
            isLongTerm = booking.SeriesId != null,
            cancelBranch,
            canCancel = policy.AllowCancel && withinDeadline && booking.Status is "PENDING" or "CONFIRMED",
            disableReason = !policy.AllowCancel
                ? "Sân này không cho phép hủy trên app."
                : !withinDeadline
                    ? $"Đã quá hạn hủy (phải hủy trước {policy.CancelBeforeMinutes} phút)."
                    : booking.Status is not ("PENDING" or "CONFIRMED")
                        ? "Đơn không ở trạng thái có thể hủy."
                        : null,
            policy = new
            {
                allowCancel = policy.AllowCancel,
                cancelBeforeMinutes = policy.CancelBeforeMinutes,
                refundType = policy.RefundType,
                refundPercent = policy.RefundPercent,
            },
            payment = new
            {
                hasProof,
                paymentConfirmed,
                paidAmount,
                pendingPaymentAmount,
                finalAmount,
            },
            refund = new
            {
                refundAmount,
                penaltyAmount,
                refundEstimateNote,
                policyDescription = policy.RefundType switch
                {
                    "FULL" => $"Hủy trước {policy.CancelBeforeMinutes} phút → hoàn 100%.",
                    "PERCENT" when policy.RefundPercent.HasValue =>
                        $"Hủy trước {policy.CancelBeforeMinutes} phút → hoàn {policy.RefundPercent}%.",
                    _ => "Sân này không hỗ trợ hoàn tiền khi hủy.",
                },
            },
        });
    }

    /// <summary>
    /// Người chơi tự huỷ đơn — tự động tạo refund_request theo nhánh.
    /// </summary>
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
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }



    /// <summary>
    /// Cancel a HOLDING booking immediately, releasing the courts for others.
    /// Only the owner of the booking can trigger this.
    /// </summary>
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
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Shared helper: update an existing HOLDING booking's contact info and refresh the hold timer.
    /// Strictly validates ownership (UserId) and HOLDING status.
    /// </summary>
    private async Task<IActionResult> UpdateHoldingBookingContact(
        Guid bookingId, Guid userId, string contactName, string contactPhone, string? note)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)
            .FirstOrDefaultAsync(b => b.Id == bookingId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        // Strict ownership validation
        if (booking.UserId != userId)
            return Forbid();

        if (booking.Status != "HOLDING")
            return BadRequest(new { message = "Chỉ có thể cập nhật đơn đang giữ chỗ (HOLDING)." });

        if (booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            return BadRequest(new { message = "Thời gian giữ chỗ đã hết. Vui lòng đặt lại.", code = "HOLD_EXPIRED" });

        // Update contact info
        booking.ContactName = contactName.Trim();
        booking.ContactPhone = contactPhone.Trim();
        booking.GuestNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        // Refresh hold timer to a new 5-minute window
        var holdExpiry = DateTime.UtcNow.AddMinutes(5);
        booking.HoldExpiresAt = holdExpiry;

        await _dbContext.SaveChangesAsync();

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        return Ok(new
        {
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status,
            holdExpiresAt = DateTime.SpecifyKind(holdExpiry, DateTimeKind.Utc),
            totalAmount = booking.TotalAmount,
            finalAmount = booking.FinalAmount,
            items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = bi.Court?.Name,
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList(),
        });
    }

    /// <summary>
    /// Player gửi / cập nhật thông tin ngân hàng nhận hoàn tiền.
    /// </summary>
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
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Player upload ảnh mã QR nhận hoàn tiền lên Cloudinary, trả về URL.
    /// </summary>
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

        if (booking.Status is not ("PENDING" or "HOLDING"))
            return BadRequest(new { message = "Chỉ có thể thanh toán khi đơn đang chờ duyệt hoặc đang giữ chỗ." });

        if (booking.Status == "HOLDING" && booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            return BadRequest(new { message = "Thời gian giữ chỗ đã hết. Vui lòng đặt lại.", code = "HOLD_EXPIRED" });

        var lastPay = booking.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
        var hasProof = lastPay != null
                       && !string.IsNullOrEmpty(lastPay.GatewayReference)
                       && lastPay.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase);

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

        var venueSlotDuration = booking.Venue?.SlotDuration ?? 60;
        var totalMins = booking.BookingItems.Count * venueSlotDuration;
        var th = totalMins / 60;
        var tm = totalMins % 60;
        var totalHoursStr = tm > 0 ? $"{th}h{tm}" : $"{th}h";

        return Ok(new
        {
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status,
            holdExpiresAt = booking.HoldExpiresAt.HasValue
                ? DateTime.SpecifyKind(booking.HoldExpiresAt.Value, DateTimeKind.Utc)
                : (DateTime?)null,
            venueId = booking.VenueId,
            venueName = booking.Venue != null ? booking.Venue.Name : null,
            venueAddress = booking.Venue != null ? booking.Venue.Address : null,
            date = booking.BookingItems.Min(bi => bi.StartTime)?.ToString("yyyy-MM-dd"),
            totalPrice = booking.FinalAmount ?? 0,
            totalHours = totalHoursStr,
            slotDuration = venueSlotDuration,
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

        try
        {
            await _bookingService.SubmitPaymentAsync(id, userId, form.Method, secureUrl, HttpContext.RequestAborted);
            return Ok(new { message = "Đã gửi minh chứng thanh toán. Vui lòng chờ chủ sân xác nhận." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("preview-discount")]
    public async Task<IActionResult> PreviewDiscount([FromBody] PreviewDiscountDto dto)
    {
        if (dto.BaseAmount <= 0)
            return BadRequest(new { message = "BaseAmount phải lớn hơn 0." });

        // Parse BookedDates (ISO yyyy-MM-dd) from FE — preferred over legacy DaysDuration
        List<DateTime> bookedDates = new();
        if (dto.BookedDates is { Count: > 0 })
        {
            foreach (var ds in dto.BookedDates)
            {
                if (DateTime.TryParse(ds, out var parsed))
                    bookedDates.Add(parsed);
            }
        }

        // Fallback: if FE doesn't send BookedDates yet (backward compat),
        // generate a fake consecutive range so old behavior still works for single-day bookings.
        if (bookedDates.Count == 0)
        {
            if (dto.DaysDuration < 1) dto.DaysDuration = 1;
            // Single-day / legacy callers: treat as 1 consecutive day (no discount)
            bookedDates.Add(DateTime.UtcNow.Date);
        }

        _ = TryGetCurrentUserId(out var previewUserId);
        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, longTermDiscountAmount, couponDiscountAmount) =
            await CalculateDiscountAsync(dto.VenueId, dto.BaseAmount, bookedDates, dto.CouponCode, previewUserId);

        // We don't block the request if there is an error in calculating coupon (e.g. invalid coupon), 
        // we just return the errorMsg in response so FE can handle it (show text "Mã không hợp lệ" etc).
        // If errorMsg is purely "Venue not found", we can return BadRequest.
        if (errorMsg == "Venue not found")
            return BadRequest(new { message = "Cơ sở không tồn tại." });

        return Ok(new
        {
            baseAmount = dto.BaseAmount,
            discountAmount,
            longTermDiscountAmount,
            couponDiscountAmount,
            finalAmount,
            isValidCoupon = couponId != null,
            errorMsg
        });
    }

    /// <summary>
    /// Tính chuỗi ngày liên tục dài nhất từ danh sách ngày có booking.
    /// "Liên tục" = mỗi ngày liền kề nhau, không ngắt quãng.
    /// </summary>
    private static int ComputeLongestConsecutiveStreak(IReadOnlyList<DateTime> bookedDates)
    {
        if (bookedDates == null || bookedDates.Count == 0) return 0;

        var uniqueDates = bookedDates
            .Select(d => d.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        if (uniqueDates.Count == 0) return 0;
        if (uniqueDates.Count == 1) return 1;

        int longestStreak = 1;
        int currentStreak = 1;

        for (int i = 1; i < uniqueDates.Count; i++)
        {
            if ((uniqueDates[i] - uniqueDates[i - 1]).Days == 1)
            {
                currentStreak++;
                if (currentStreak > longestStreak)
                    longestStreak = currentStreak;
            }
            else
            {
                currentStreak = 1;
            }
        }

        return longestStreak;
    }

    private async Task<(decimal DiscountAmount, decimal FinalAmount, Guid? CouponId, ShuttleUp.DAL.Models.VenueCoupon? CouponToUpdate, string? ErrorMsg, decimal LongTermDiscountAmount, decimal CouponDiscountAmount)> CalculateDiscountAsync(
        Guid venueId,
        decimal totalAmount,
        IReadOnlyList<DateTime> bookedDates,
        string? couponCode,
        Guid? userIdForCouponCheck)
    {
        var venue = await _dbContext.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == venueId);
        if (venue == null) return (0, totalAmount, null, null, "Venue not found", 0, 0);

        // Tính chuỗi ngày liên tục dài nhất (consecutive streak)
        var consecutiveStreak = ComputeLongestConsecutiveStreak(bookedDates);

        decimal autoDiscountAmount = 0;
        
        if (consecutiveStreak >= 30 && venue.MonthlyDiscountPercent > 0)
        {
            autoDiscountAmount = totalAmount * (venue.MonthlyDiscountPercent.Value / 100m);
        }
        else if (consecutiveStreak >= 7 && venue.WeeklyDiscountPercent > 0)
        {
            autoDiscountAmount = totalAmount * (venue.WeeklyDiscountPercent.Value / 100m);
        }

        decimal discountAmount = autoDiscountAmount;
        decimal finalAmount = totalAmount - discountAmount;
        Guid? couponId = null;
        ShuttleUp.DAL.Models.VenueCoupon? couponToUpdate = null;

        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            var codeNorm = couponCode.Trim().ToUpperInvariant();
            var coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.VenueId == venueId && c.Code == codeNorm && c.IsActive == true);
            if (coupon == null)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá không hợp lệ hoặc đã bị khóa.", autoDiscountAmount, 0);

            var now = DateTime.UtcNow;
            if (now < coupon.StartDate || now > coupon.EndDate)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá không trong thời gian sử dụng.", autoDiscountAmount, 0);

            if (coupon.MinBookingValue > 0 && finalAmount < coupon.MinBookingValue)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, $"Mã giảm giá yêu cầu giá trị đơn tối thiểu {coupon.MinBookingValue:N0} VNĐ (sau khi đã trừ tự động).", autoDiscountAmount, 0);

            if (coupon.UsageLimit.HasValue && (coupon.UsedCount ?? 0) >= coupon.UsageLimit.Value)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá đã hết lượt sử dụng.", autoDiscountAmount, 0);

            if (coupon.OneUsePerUser && userIdForCouponCheck is { } uid && uid != Guid.Empty)
            {
                var alreadyUsed = await _dbContext.Bookings.AsNoTracking()
                    .AnyAsync(b => b.UserId == uid
                        && b.CouponId == coupon.Id
                        && b.Status != null
                        && b.Status != "CANCELLED");
                if (alreadyUsed)
                    return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã này chỉ dùng được một lần cho mỗi tài khoản. Bạn đã sử dụng trước đó.", autoDiscountAmount, 0);
            }

            decimal couponDiscount = 0;
            if (coupon.DiscountType == "PERCENT")
            {
                couponDiscount = finalAmount * (coupon.DiscountValue / 100m);
                if (coupon.MaxDiscountAmount.HasValue && couponDiscount > coupon.MaxDiscountAmount.Value)
                {
                    couponDiscount = coupon.MaxDiscountAmount.Value;
                }
            }
            else
            {
                couponDiscount = coupon.DiscountValue;
            }

            if (couponDiscount > finalAmount) couponDiscount = finalAmount;

            discountAmount += couponDiscount;
            finalAmount -= couponDiscount;
            couponId = coupon.Id;
            couponToUpdate = coupon;
        }

        var couponDiscountAmount = discountAmount - autoDiscountAmount;
        return (discountAmount, finalAmount, couponId, couponToUpdate, null, autoDiscountAmount, couponDiscountAmount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SOFT REMINDER — Người chơi giục chủ sân duyệt đơn PENDING
    // ═══════════════════════════════════════════════════════════════════

    /// <summary>
    /// POST /api/bookings/{id}/remind-owner
    /// Gửi Email + Notification cho chủ sân nhắc duyệt đơn PENDING.
    /// Rate-limited: 1 lần / giờ (configurable) per booking via IMemoryCache.
    /// </summary>
    [HttpPost("{id:guid}/remind-owner")]
    public async Task<IActionResult> RemindOwner([FromRoute] Guid id)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .Include(b => b.Venue)
                .ThenInclude(v => v!.OwnerUser)
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt sân." });

        if (booking.Status != "PENDING")
            return BadRequest(new { message = "Chỉ có thể nhắc chủ sân khi đơn đang ở trạng thái Chờ duyệt." });

        var owner = booking.Venue?.OwnerUser;
        if (owner == null)
            return BadRequest(new { message = "Không tìm thấy thông tin chủ sân." });

        // ── Rate limit via IMemoryCache ──
        var cooldownMinutes = _configuration.GetValue("ReminderSettings:SoftReminderCooldownMinutes", 60);
        var cacheKey = $"SoftReminder_{id}";
        if (_cache.TryGetValue(cacheKey, out DateTime lastSent))
        {
            var remaining = lastSent.AddMinutes(cooldownMinutes) - DateTime.UtcNow;
            if (remaining > TimeSpan.Zero)
            {
                var mins = (int)Math.Ceiling(remaining.TotalMinutes);
                return StatusCode(429, new
                {
                    message = $"Bạn đã nhắc chủ sân rồi. Vui lòng chờ thêm {mins} phút nữa.",
                    remainingMinutes = mins
                });
            }
        }

        // ── Build notification & email ──
        var playerName = booking.User?.FullName ?? booking.ContactName ?? "Khách hàng";
        var venueName = booking.Venue?.Name ?? "sân";
        var bookingCode = booking.Id.ToString()[..8].ToUpper();

        var title = $"📋 Khách hàng nhắc duyệt đơn đặt sân";
        var body = $"{playerName} đang chờ bạn duyệt đơn #{bookingCode} tại {venueName}. "
                 + "Vui lòng vào hệ thống để xác nhận hoặc từ chối.";

        var frontendUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";
        var managerLink = $"{frontendUrl}/manager/bookings";

        var htmlBody = $"""
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Nhắc nhở duyệt đơn đặt sân</p>
              </div>
              <div style="padding:24px">
                <p style="color:#334155;font-size:15px;margin:0 0 16px">
                  Xin chào <strong>{System.Net.WebUtility.HtmlEncode(owner.FullName ?? owner.Email ?? "Chủ sân")}</strong>,
                </p>
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px">
                  <p style="margin:0;color:#92400e;font-size:14px">
                    ⏳ Khách hàng <strong>{System.Net.WebUtility.HtmlEncode(playerName)}</strong>
                    đang chờ bạn duyệt đơn đặt sân <strong>#{bookingCode}</strong>
                    tại <strong>{System.Net.WebUtility.HtmlEncode(venueName)}</strong>.
                  </p>
                </div>
                <div style="text-align:center;margin:20px 0">
                  <a href="{managerLink}"
                     style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;
                            border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                    Xem danh sách đơn đặt sân
                  </a>
                </div>
                <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center">
                  Bạn nhận được email này vì có đơn đặt sân đang chờ xử lý trên ShuttleUp.
                </p>
              </div>
            </div>
            """;

        await _notify.NotifyUserAsync(
            owner.Id,
            NotificationTypes.BookingManagerReminder,
            title,
            body,
            metadata: new { bookingId = booking.Id, venueId = booking.VenueId },
            sendEmail: true,
            htmlBodyOverride: htmlBody,
            cancellationToken: HttpContext.RequestAborted);

        // Set cache — hạn = cooldownMinutes
        _cache.Set(cacheKey, DateTime.UtcNow, TimeSpan.FromMinutes(cooldownMinutes));

        return Ok(new { message = "Đã gửi nhắc nhở đến chủ sân thành công!" });
    }
}

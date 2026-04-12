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
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Helpers;
using ShuttleUp.Backend.Services;
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
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _configuration;

    public BookingsController(
        ShuttleUpDbContext dbContext,
        IFileService fileService,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle,
        IMemoryCache cache,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _fileService = fileService;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
        _cache = cache;
        _configuration = configuration;
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

        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "Vui lòng chọn ít nhất một khung giờ." });

        if (string.IsNullOrWhiteSpace(dto.ContactName))
            return BadRequest(new { message = "Vui lòng nhập họ tên." });

        if (string.IsNullOrWhiteSpace(dto.ContactPhone))
            return BadRequest(new { message = "Vui lòng nhập số điện thoại." });

        // ── Update-in-place: if bookingId is provided, update existing HOLDING record ──
        if (dto.BookingId.HasValue)
        {
            return await UpdateHoldingBookingContact(dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note);
        }

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
                v.SlotDuration,
            })
            .FirstOrDefaultAsync();

        if (venuePolicy == null)
            return BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." });

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync();

        if (courts.Count != courtIds.Count)
            return BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." });

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById, venuePolicy.SlotDuration);
        if (normErr != null)
            return BadRequest(new { message = normErr });

        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, HttpContext.RequestAborted, excludeBookingId: dto.BookingId, excludeHoldingUserId: userId);
        if (conflict == "CONFLICT_BOOKING")
            return Conflict(new { message = "Một hoặc nhiều khung giờ vừa được người khác đặt. Vui lòng chọn lại." });
        if (conflict == "CONFLICT_BLOCK")
            return Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." });

        var total = normalizedItems.Sum(x => x.Price);
        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);
        var daysDuration = (maxEnd.Date - minStart.Date).Days + 1;

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });

        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

        var holdExpiry = DateTime.UtcNow.AddMinutes(5);

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            Status = "HOLDING",
            HoldExpiresAt = holdExpiry,
            TotalAmount = total,
            DiscountAmount = discountAmount,
            FinalAmount = finalAmount,
            CouponId = couponId,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            GuestNote = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            CancellationPolicySnapshotJson = JsonSerializer.Serialize(policySnapshot),
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
                Status = "HOLDING"
            });
        }

        await using var trx = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
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
            HoldExpiresAt = holdExpiry,
            TotalAmount = total,
            FinalAmount = finalAmount,
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
    /// Xem trước đặt lịch dài hạn (không ghi DB).
    /// </summary>
    [HttpPost("long-term/preview")]
    public async Task<IActionResult> PreviewLongTerm([FromBody] LongTermScheduleDto dto)
    {
        if (!TryGetCurrentUserId(out _))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var built = await BuildLongTermNormalizedAsync(dto, HttpContext.RequestAborted);
        if (built.Error != null)
            return built.Error;

        // Smart allocation path
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

        // Legacy single-court path
        var legacyTotal = built.NormalizedItems!.Sum(x => x.Price);
        var legacySessionCount = CountDistinctSessionDays(built.NormalizedItems!);

        return Ok(new
        {
            venueId = dto.VenueId,
            courtId = dto.CourtId,
            courtName = built.Court!.Name,
            slotCount = built.NormalizedItems!.Count,
            unavailableCount = 0,
            sessionCount = legacySessionCount,
            totalAmount = legacyTotal,
            isFlexible = false,
            items = built.NormalizedItems!.Select(x => new
            {
                courtId = (Guid?)x.CourtId,
                courtName = built.Court.Name,
                startTime = x.Start,
                endTime = x.End,
                price = x.Price,
                isUnavailable = false,
                isSwitched = false,
                switchReason = (string?)null,
            }),
        });
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

        // ── Update-in-place: if bookingId is provided, update existing HOLDING record ──
        if (dto.BookingId.HasValue)
        {
            return await UpdateHoldingBookingContact(dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note);
        }

        var built = await BuildLongTermNormalizedAsync(dto, HttpContext.RequestAborted);
        if (built.Error != null)
            return built.Error;

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

        decimal total = 0;
        DateTime minStart;
        DateTime maxEnd;

        if (built.SmartItems != null)
        {
            var availableItems = built.SmartItems.Where(x => !x.IsUnavailable && x.CourtId.HasValue).ToList();
            if (availableItems.Count == 0)
                return BadRequest(new { message = "Không có khung giờ nào khả dụng để đặt." });

            total = availableItems.Sum(x => x.Price);
            minStart = availableItems.Min(x => x.Start);
            maxEnd = availableItems.Max(x => x.End);
        }
        else
        {
            if (built.NormalizedItems == null || built.NormalizedItems.Count == 0)
                return BadRequest(new { message = "Không có khung giờ hợp lệ." });

            total = built.NormalizedItems.Sum(x => x.Price);
            minStart = built.NormalizedItems.Min(x => x.Start);
            maxEnd = built.NormalizedItems.Max(x => x.End);
        }

        var daysDuration = (maxEnd.Date - minStart.Date).Days + 1;

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });
        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

        var holdExpiry = DateTime.UtcNow.AddMinutes(5);

        var ruleJson = JsonSerializer.Serialize(new
        {
            type = "WEEKLY",
            daysOfWeek = dto.DaysOfWeek,
            sessionStart = dto.SessionStartTime,
            sessionEnd = dto.SessionEndTime,
            courtId = dto.CourtId,
        });

        var series = new BookingSeries
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            RecurrenceRuleJson = ruleJson,
            RangeStartDate = built.RangeStart!.Value,
            RangeEndDate = built.RangeEnd!.Value,
            Status = "HOLDING",
            CreatedAt = DateTime.UtcNow,
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            SeriesId = series.Id,
            Status = "HOLDING",
            HoldExpiresAt = holdExpiry,
            TotalAmount = total,
            DiscountAmount = discountAmount,
            FinalAmount = finalAmount,
            CouponId = couponId,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            GuestNote = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            CancellationPolicySnapshotJson = JsonSerializer.Serialize(policySnapshot),
            CreatedAt = DateTime.UtcNow
        };

        // Smart allocation: filter out unavailable, use SmartItems if present
        if (built.SmartItems != null)
        {
            var availableItems = built.SmartItems.Where(x => !x.IsUnavailable && x.CourtId.HasValue).ToList();
            foreach (var si in availableItems)
            {
                booking.BookingItems.Add(new BookingItem
                {
                    Id = Guid.NewGuid(),
                    CourtId = si.CourtId!.Value,
                    StartTime = si.Start,
                    EndTime = si.End,
                    FinalPrice = si.Price,
                    Status = "HOLDING"
                });
            }
        }
        else
        {
            foreach (var ni in built.NormalizedItems!)
            {
                booking.BookingItems.Add(new BookingItem
                {
                    Id = Guid.NewGuid(),
                    CourtId = ni.CourtId,
                    StartTime = ni.Start,
                    EndTime = ni.End,
                    FinalPrice = ni.Price,
                    Status = "HOLDING"
                });
            }
        }

        await using var trx = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
            _dbContext.BookingSeries.Add(series);
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
        
        Dictionary<Guid, string> courtNames = new();
        if (built.SmartItems != null)
        {
            foreach (var si in built.SmartItems.Where(x => x.CourtId.HasValue))
            {
                courtNames[si.CourtId!.Value] = si.CourtName ?? "—";
            }
        }
        else if (built.Court != null)
        {
            courtNames[built.Court.Id] = built.Court.Name;
        }

        return StatusCode(StatusCodes.Status201Created, new
        {
            seriesId = series.Id,
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status,
            holdExpiresAt = holdExpiry,
            totalAmount = total,
            finalAmount,
            items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = courtNames.GetValueOrDefault(bi.CourtId ?? Guid.Empty),
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList(),
        });
    }

    /// <summary>
    /// Xem trước đặt lịch dài hạn linh hoạt (nhiều slot tự chọn, không ghi DB).
    /// </summary>
    [HttpPost("long-term/flexible/preview")]
    public async Task<IActionResult> PreviewLongTermFlexible([FromBody] LongTermFlexibleScheduleDto dto)
    {
        if (!TryGetCurrentUserId(out _))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var built = await BuildFlexibleLongTermAsync(dto, HttpContext.RequestAborted);
        if (built.Error != null)
            return built.Error;

        var total = built.NormalizedItems!.Sum(x => x.Price);
        var courtById = built.CourtById!;

        return Ok(new
        {
            venueId = dto.VenueId,
            slotCount = built.NormalizedItems!.Count,
            totalAmount = total,
            rangeStart = built.RangeStart!.Value.ToString("yyyy-MM-dd"),
            rangeEnd = built.RangeEnd!.Value.ToString("yyyy-MM-dd"),
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

        // ── Update-in-place: if bookingId is provided, update existing HOLDING record ──
        if (dto.BookingId.HasValue)
        {
            return await UpdateHoldingBookingContact(dto.BookingId.Value, userId, dto.ContactName, dto.ContactPhone, dto.Note);
        }

        var built = await BuildFlexibleLongTermAsync(dto, HttpContext.RequestAborted);
        if (built.Error != null)
            return built.Error;

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

        var normalizedItems = built.NormalizedItems!;
        var total = normalizedItems.Sum(x => x.Price);
        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);
        var daysDuration = (maxEnd.Date - minStart.Date).Days + 1;

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });
        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

        var holdExpiry = DateTime.UtcNow.AddMinutes(5);

        var ruleJson = JsonSerializer.Serialize(new
        {
            type = "FLEXIBLE",
            itemCount = normalizedItems.Count,
        });

        var series = new BookingSeries
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            RecurrenceRuleJson = ruleJson,
            RangeStartDate = built.RangeStart!.Value,
            RangeEndDate = built.RangeEnd!.Value,
            Status = "HOLDING",
            CreatedAt = DateTime.UtcNow,
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            SeriesId = series.Id,
            Status = "HOLDING",
            HoldExpiresAt = holdExpiry,
            TotalAmount = total,
            DiscountAmount = discountAmount,
            FinalAmount = finalAmount,
            CouponId = couponId,
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
                Status = "HOLDING"
            });
        }

        await using var trx = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
            _dbContext.BookingSeries.Add(series);
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
        var courtById = built.CourtById!;

        return StatusCode(StatusCodes.Status201Created, new
        {
            seriesId = series.Id,
            bookingId = booking.Id,
            bookingCode = code,
            status = booking.Status,
            holdExpiresAt = holdExpiry,
            totalAmount = total,
            finalAmount,
            items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = courtById.GetValueOrDefault(bi.CourtId ?? Guid.Empty)?.Name,
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList(),
        });
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
                hasValidPaymentProof = b.HasValidPaymentProof,
                needsPaymentRetry = b.Status == "PENDING" && !b.HasValidPaymentProof,
                b.Items,
                refundStatus = refund?.Status,
                refundAmount = refund?.RequestedAmount,
                refundBankName = refund?.RefundBankName,
                refundAccountNumber = refund?.RefundAccountNumber,
                refundAccountHolder = refund?.RefundAccountHolder,
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

    public class CancelBookingBody
    {
        public string? RefundBankName { get; set; }
        public string? RefundAccountNumber { get; set; }
        public string? RefundAccountHolder { get; set; }
        public string? PlayerNote { get; set; }
    }

    /// <summary>
    /// Người chơi tự huỷ đơn — tự động tạo refund_request theo nhánh.
    /// </summary>
    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> CancelMyBooking([FromRoute] Guid id, [FromBody] CancelBookingBody? body)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status is "CANCELLED" or "PENDING_RECONCILIATION" or "PENDING_REFUND" or "REFUNDED")
            return BadRequest(new { message = "Đơn đã bị huỷ hoặc đang xử lý hoàn tiền." });

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

        var (hasProof, paymentConfirmed, paidAmount) = AnalyzePaymentState(booking.Payments);
        var finalAmount = booking.FinalAmount ?? booking.TotalAmount ?? 0;

        string cancelBranch;
        string newBookingStatus;
        string? refundRequestStatus = null;

        if (paymentConfirmed)
        {
            cancelBranch = "PAID";
            newBookingStatus = "PENDING_REFUND";
            refundRequestStatus = "PENDING_REFUND";
        }
        else if (hasProof)
        {
            cancelBranch = "PROOF_UPLOADED";
            newBookingStatus = "PENDING_RECONCILIATION";
            refundRequestStatus = "PENDING_RECONCILIATION";
        }
        else
        {
            cancelBranch = "NO_PAYMENT";
            newBookingStatus = "CANCELLED";
        }

        booking.Status = newBookingStatus;
        foreach (var item in booking.BookingItems)
            item.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : item.Status;

        if (newBookingStatus == "CANCELLED")
        {
            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId);
            if (series != null)
                series.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : "CANCELLING";
        }

        RefundRequest? refundReq = null;
        if (refundRequestStatus != null)
        {
            decimal refundAmount = 0;
            if (cancelBranch == "PAID")
                refundAmount = policy.ComputeRefundAmount(paidAmount);

            refundReq = new RefundRequest
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                UserId = userId,
                ReasonCode = "PLAYER_CANCEL",
                Status = refundRequestStatus,
                RequestedAmount = refundAmount,
                PaidAmount = cancelBranch == "PAID" ? paidAmount : null,
                RefundBankName = body?.RefundBankName?.Trim(),
                RefundAccountNumber = body?.RefundAccountNumber?.Trim(),
                RefundAccountHolder = body?.RefundAccountHolder?.Trim().ToUpperInvariant(),
                PlayerNote = body?.PlayerNote?.Trim(),
                RequestedAt = DateTime.UtcNow,
            };
            _dbContext.RefundRequests.Add(refundReq);
        }

        await _dbContext.SaveChangesAsync();

        await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "người chơi", HttpContext.RequestAborted);

        if (booking.VenueId.HasValue)
        {
            var ownerId = await _dbContext.Venues
                .Where(v => v.Id == booking.VenueId)
                .Select(v => v.OwnerUserId)
                .FirstOrDefaultAsync();
            if (ownerId.HasValue)
            {
                var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
                var title = cancelBranch switch
                {
                    "PAID" => "Yêu cầu hoàn tiền mới",
                    "PROOF_UPLOADED" => "Đơn hủy cần đối soát",
                    _ => "Đơn đặt sân bị hủy",
                };
                var notifBody = $"Đơn #{code} đã bị người chơi hủy" + cancelBranch switch
                {
                    "PAID" => " — vui lòng xử lý hoàn tiền.",
                    "PROOF_UPLOADED" => " — có chứng từ CK cần đối soát.",
                    _ => ".",
                };
                await _notify.NotifyUserAsync(
                    ownerId.Value,
                    NotificationTypes.RefundRequest,
                    title, notifBody,
                    new { bookingId = booking.Id, status = newBookingStatus, entityType = "refund", deepLink = "/manager/refunds" },
                    sendEmail: false,
                    cancellationToken: HttpContext.RequestAborted);
            }
        }

        return Ok(new
        {
            message = cancelBranch switch
            {
                "PAID" => "Đã hủy đơn. Yêu cầu hoàn tiền đã được gửi đến chủ sân.",
                "PROOF_UPLOADED" => "Đã hủy đơn. Vui lòng chờ chủ sân đối soát biên lai trước khi xử lý hoàn tiền.",
                _ => "Đã huỷ đặt sân thành công.",
            },
            bookingId = booking.Id,
            bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant(),
            status = newBookingStatus,
            cancelBranch,
            refundRequestId = refundReq?.Id,
        });
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

        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        // Strict ownership validation
        if (booking.UserId != userId)
            return Forbid();

        if (booking.Status != "HOLDING")
            return BadRequest(new { message = "Chỉ có thể huỷ đơn đang giữ chỗ (HOLDING)." });

        booking.Status = "CANCELLED";
        booking.HoldExpiresAt = null;

        foreach (var item in booking.BookingItems)
            item.Status = "CANCELLED";

        // Cancel the series too, if any
        if (booking.SeriesId is { } seriesId)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId);
            if (series != null)
                series.Status = "CANCELLED";
        }

        // Restore coupon usage if one was applied
        if (booking.CouponId.HasValue)
        {
            var coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.Id == booking.CouponId.Value);
            if (coupon != null && (coupon.UsedCount ?? 0) > 0)
                coupon.UsedCount = (coupon.UsedCount ?? 0) - 1;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã huỷ giữ chỗ thành công. Các khung giờ đã được giải phóng.",
            bookingId = booking.Id,
            status = booking.Status,
        });
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
    public async Task<IActionResult> UpdateRefundBankInfo([FromRoute] Guid id, [FromBody] CancelBookingBody body)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var refund = await _dbContext.RefundRequests
            .FirstOrDefaultAsync(r => r.BookingId == id && r.UserId == userId
                                      && r.Status != "COMPLETED" && r.Status != "REJECTED");
        if (refund == null)
            return NotFound(new { message = "Không tìm thấy yêu cầu hoàn tiền." });

        if (!string.IsNullOrWhiteSpace(body.RefundBankName))
            refund.RefundBankName = body.RefundBankName.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountNumber))
            refund.RefundAccountNumber = body.RefundAccountNumber.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountHolder))
            refund.RefundAccountHolder = body.RefundAccountHolder.Trim().ToUpperInvariant();

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật thông tin nhận hoàn tiền." });
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

        var booking = await _dbContext.Bookings
            .Include(b => b.Venue)
                .ThenInclude(v => v!.OwnerUser)
            .Include(b => b.Payments)
            .Include(b => b.BookingItems)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status == "CANCELLED")
            return BadRequest(new { message = "Đơn đã bị huỷ." });

        if (booking.Status is not ("PENDING" or "HOLDING"))
            return BadRequest(new { message = "Chỉ có thể nộp minh chứng khi đơn đang chờ duyệt hoặc đang giữ chỗ." });

        if (booking.Status == "HOLDING" && booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            return BadRequest(new { message = "Thời gian giữ chỗ đã hết. Vui lòng đặt lại.", code = "HOLD_EXPIRED" });

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
            && !string.IsNullOrEmpty(existingPending.GatewayReference)
            && existingPending.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Đơn đã có minh chứng thanh toán. Không gửi lại." });
        }

        var wasHolding = booking.Status == "HOLDING";
        if (wasHolding)
        {
            booking.Status = "PENDING";
            booking.HoldExpiresAt = null;
            foreach (var item in booking.BookingItems)
                item.Status = "PENDING";

            if (booking.SeriesId is { } seriesId)
            {
                var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId);
                if (series != null) series.Status = "PENDING";
            }
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

        if (booking.Venue?.OwnerUserId is { } mgrId && mgrId != Guid.Empty)
        {
            try
            {
                var notifTitle = wasHolding ? "📢 Có đơn đặt sân mới chờ duyệt" : "Có minh chứng thanh toán mới";
                var notifBody = wasHolding
                    ? $"Mã {bookingCode} — {booking.ContactName} — {booking.FinalAmount:N0} VNĐ."
                    : $"Đơn {bookingCode} vừa có ảnh chứng từ từ người chơi.";
                var notifType = wasHolding ? NotificationTypes.BookingNew : NotificationTypes.PaymentProof;

                // Build branded HTML email for new booking alert
                string? newBookingHtml = null;
                if (wasHolding)
                {
                    var ownerName = booking.Venue?.OwnerUser?.FullName ?? "Chủ sân";
                    var vName = booking.Venue?.Name ?? "sân";
                    var contactName = booking.ContactName ?? "Khách hàng";
                    var frontUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";
                    var mgrLink = $"{frontUrl}/manager/bookings";

                    newBookingHtml = $"""
                        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                          <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                            <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Đơn đặt sân mới</p>
                          </div>
                          <div style="padding:24px">
                            <p style="color:#334155;font-size:15px;margin:0 0 16px">
                              Xin chào <strong>{System.Net.WebUtility.HtmlEncode(ownerName)}</strong>,
                            </p>
                            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
                              <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
                                <tr>
                                  <td style="padding:6px 0;font-weight:600;width:130px">📋 Mã đơn:</td>
                                  <td style="padding:6px 0"><strong>{bookingCode}</strong></td>
                                </tr>
                                <tr>
                                  <td style="padding:6px 0;font-weight:600">👤 Khách hàng:</td>
                                  <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(contactName)}</td>
                                </tr>
                                <tr>
                                  <td style="padding:6px 0;font-weight:600">📍 Sân:</td>
                                  <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(vName)}</td>
                                </tr>
                                <tr>
                                  <td style="padding:6px 0;font-weight:600">💰 Tổng tiền:</td>
                                  <td style="padding:6px 0"><strong>{booking.FinalAmount:N0} VNĐ</strong></td>
                                </tr>
                              </table>
                            </div>
                            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:20px">
                              <p style="margin:0;color:#92400e;font-size:13px">⏰ Duyệt đơn nhanh trong vòng <strong>60 phút</strong> để duy trì huy hiệu <strong>Elite Owner</strong>!</p>
                            </div>
                            <div style="text-align:center;margin:20px 0">
                              <a href="{mgrLink}"
                                 style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;
                                        border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                                Xem và duyệt đơn ngay
                              </a>
                            </div>
                            <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center">
                              Bạn nhận được email này vì có đơn đặt sân mới trên ShuttleUp.
                            </p>
                          </div>
                        </div>
                        """;
                }

                await _notify.NotifyUserAsync(
                    mgrId,
                    notifType,
                    notifTitle,
                    notifBody,
                    NotificationMetadataBuilder.BookingForManager(booking.Id, booking.VenueId),
                    sendEmail: wasHolding,
                    htmlBodyOverride: newBookingHtml);
            }
            catch (Exception ex)
            {
                _ = ex; /* swallow — do not break payment flow */
            }
        }

        return Ok(new
        {
            paymentId = paymentRow.Id,
            paymentRow.Status,
            paymentRow.Method,
            paymentRow.Amount,
            proofUrl = secureUrl,
            bookingId = booking.Id,
            bookingCode,
            bookingStatus = booking.Status,
        });
    }

    [HttpPost("preview-discount")]
    public async Task<IActionResult> PreviewDiscount([FromBody] PreviewDiscountDto dto)
    {
        if (dto.BaseAmount <= 0)
            return BadRequest(new { message = "BaseAmount phải lớn hơn 0." });

        if (dto.DaysDuration < 1) dto.DaysDuration = 1;

        _ = TryGetCurrentUserId(out var previewUserId);
        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, longTermDiscountAmount, couponDiscountAmount) =
            await CalculateDiscountAsync(dto.VenueId, dto.BaseAmount, dto.DaysDuration, dto.CouponCode, previewUserId);

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

    private async Task<(decimal DiscountAmount, decimal FinalAmount, Guid? CouponId, ShuttleUp.DAL.Models.VenueCoupon? CouponToUpdate, string? ErrorMsg, decimal LongTermDiscountAmount, decimal CouponDiscountAmount)> CalculateDiscountAsync(
        Guid venueId,
        decimal totalAmount,
        int daysDuration,
        string? couponCode,
        Guid? userIdForCouponCheck)
    {
        var venue = await _dbContext.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == venueId);
        if (venue == null) return (0, totalAmount, null, null, "Venue not found", 0, 0);

        decimal autoDiscountAmount = 0;
        
        if (daysDuration >= 30 && venue.MonthlyDiscountPercent > 0)
        {
            autoDiscountAmount = totalAmount * (venue.MonthlyDiscountPercent.Value / 100m);
        }
        else if (daysDuration >= 7 && venue.WeeklyDiscountPercent > 0)
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

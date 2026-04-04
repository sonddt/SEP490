using System.IdentityModel.Tokens.Jwt;
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

    public BookingsController(
        ShuttleUpDbContext dbContext,
        IFileService fileService,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle)
    {
        _dbContext = dbContext;
        _fileService = fileService;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
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

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync();

        if (courts.Count != courtIds.Count)
            return BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." });

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById);
        if (normErr != null)
            return BadRequest(new { message = normErr });

        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, HttpContext.RequestAborted);
        if (conflict == "CONFLICT_BOOKING")
            return Conflict(new { message = "Một hoặc nhiều khung giờ vừa được người khác đặt. Vui lòng chọn lại." });
        if (conflict == "CONFLICT_BLOCK")
            return Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." });

        var total = normalizedItems.Sum(x => x.Price);
        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);
        var daysDuration = (maxEnd.Date - minStart.Date).Days + 1;

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });

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
                Status = "PENDING"
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

        var ownerId = await _dbContext.Venues.AsNoTracking()
            .Where(v => v.Id == dto.VenueId)
            .Select(v => v.OwnerUserId)
            .FirstOrDefaultAsync();
        if (ownerId is { } oid && oid != Guid.Empty)
        {
            try
            {
                await _notify.NotifyUserAsync(
                    oid,
                    NotificationTypes.BookingNew,
                    "Có đơn đặt sân mới",
                    $"Mã {code} — {dto.ContactName.Trim()} — {total:N0} VNĐ.",
                    NotificationMetadataBuilder.BookingForManager(booking.Id, dto.VenueId),
                    sendEmail: true);
            }
            catch
            {
                /* không chặn response 201 */
            }
        }

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

        var total = built.NormalizedItems!.Sum(x => x.Price);
        var sessionCount = CountDistinctSessionDays(built.NormalizedItems!);

        return Ok(new
        {
            venueId = dto.VenueId,
            courtId = dto.CourtId,
            courtName = built.Court!.Name,
            slotCount = built.NormalizedItems!.Count,
            sessionCount,
            totalAmount = total,
            items = built.NormalizedItems!.Select(x => new
            {
                courtId = x.CourtId,
                startTime = x.Start,
                endTime = x.End,
                price = x.Price,
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

        var total = built.NormalizedItems!.Sum(x => x.Price);
        var minStart = built.NormalizedItems!.Min(x => x.Start);
        var maxEnd = built.NormalizedItems!.Max(x => x.End);
        var daysDuration = (maxEnd.Date - minStart.Date).Days + 1;

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });
        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

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
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow,
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            SeriesId = series.Id,
            Status = "PENDING",
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

        foreach (var ni in built.NormalizedItems!)
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
        var courtById = new Dictionary<Guid, Court> { [built.Court!.Id] = built.Court };

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

        var ownerId = await _dbContext.Venues.AsNoTracking()
            .Where(v => v.Id == dto.VenueId)
            .Select(v => v.OwnerUserId)
            .FirstOrDefaultAsync();
        if (ownerId is { } oid && oid != Guid.Empty)
        {
            try
            {
                await _notify.NotifyUserAsync(
                    oid,
                    NotificationTypes.BookingNew,
                    "Có đơn đặt lịch dài hạn mới",
                    $"Mã {code} — {dto.ContactName.Trim()} — {built.NormalizedItems.Count} khung — {total:N0} VNĐ.",
                    NotificationMetadataBuilder.BookingForManager(booking.Id, dto.VenueId),
                    sendEmail: true);
            }
            catch
            {
                /* ignore */
            }
        }

        return StatusCode(StatusCodes.Status201Created, new
        {
            seriesId = series.Id,
            response.BookingId,
            response.BookingCode,
            response.Status,
            response.TotalAmount,
            response.FinalAmount,
            response.Items,
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

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg) = await CalculateDiscountAsync(dto.VenueId, total, daysDuration, dto.CouponCode, userId);
        if (errorMsg != null) return BadRequest(new { message = errorMsg });
        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

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
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow,
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            SeriesId = series.Id,
            Status = "PENDING",
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
                Status = "PENDING"
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

        var ownerId = await _dbContext.Venues.AsNoTracking()
            .Where(v => v.Id == dto.VenueId)
            .Select(v => v.OwnerUserId)
            .FirstOrDefaultAsync();
        if (ownerId is { } oid && oid != Guid.Empty)
        {
            try
            {
                await _notify.NotifyUserAsync(
                    oid,
                    NotificationTypes.BookingNew,
                    "Có đơn đặt lịch dài hạn (linh hoạt) mới",
                    $"Mã {code} — {dto.ContactName.Trim()} — {normalizedItems.Count} khung — {total:N0} VNĐ.",
                    NotificationMetadataBuilder.BookingForManager(booking.Id, dto.VenueId),
                    sendEmail: true);
            }
            catch
            {
                /* ignore */
            }
        }

        return StatusCode(StatusCodes.Status201Created, new
        {
            seriesId = series.Id,
            response.BookingId,
            response.BookingCode,
            response.Status,
            response.TotalAmount,
            response.FinalAmount,
            response.Items,
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

        var venueOk = await _dbContext.Venues.AnyAsync(v => v.Id == dto.VenueId && v.IsActive == true, ct);
        if (!venueOk)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." }) };

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync(ct);

        if (courts.Count != courtIds.Count)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." }) };

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById);
        if (normErr != null)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = normErr }) };

        if (normalizedItems.Count > BookingSlotHelper.MaxLongTermSlots)
            return new FlexibleLongTermBuildResult { Error = BadRequest(new { message = $"Vượt quá số khung tối đa ({BookingSlotHelper.MaxLongTermSlots} ô × 30 phút)." }) };

        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct);
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

        var court = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .FirstOrDefaultAsync(c => c.Id == dto.CourtId && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE", ct);

        if (court == null)
            return new LongTermBuildResult { Error = BadRequest(new { message = "Sân không thuộc cơ sở hoặc không hoạt động." }) };

        var venueOk = await _dbContext.Venues.AnyAsync(v => v.Id == dto.VenueId && v.IsActive == true, ct);
        if (!venueOk)
            return new LongTermBuildResult { Error = BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." }) };

        var (normalizedItems, expandErr) = BookingSlotHelper.ExpandWeeklyLongTerm(
            dto.CourtId, court, rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots);
        if (expandErr != null)
            return new LongTermBuildResult { Error = BadRequest(new { message = expandErr }) };

        var courtIds = new List<Guid> { dto.CourtId };
        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct);
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
        var refundMap = await _dbContext.RefundRequests
            .AsNoTracking()
            .Where(r => r.BookingId != null && bookingIds.Contains(r.BookingId.Value))
            .GroupBy(r => r.BookingId!.Value)
            .Select(g => g.OrderByDescending(r => r.RequestedAt).First())
            .ToDictionaryAsync(r => r.BookingId!.Value);

        var withCode = rows.Select(b =>
        {
            refundMap.TryGetValue(b.Id, out var refund);
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

        if (booking.Status != "PENDING")
            return BadRequest(new { message = "Chỉ có thể thanh toán khi đơn đang chờ duyệt." });

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
            .Include(b => b.Venue)
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

        if (booking.Venue?.OwnerUserId is { } mgrId && mgrId != Guid.Empty)
        {
            try
            {
                await _notify.NotifyUserAsync(
                    mgrId,
                    NotificationTypes.PaymentProof,
                    "Có minh chứng thanh toán mới",
                    $"Đơn {bookingCode} vừa có ảnh chứng từ từ người chơi.",
                    NotificationMetadataBuilder.BookingForManager(booking.Id, booking.VenueId),
                    sendEmail: false);
            }
            catch
            {
                /* ignore */
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
            bookingCode
        });
    }

    [HttpPost("preview-discount")]
    public async Task<IActionResult> PreviewDiscount([FromBody] PreviewDiscountDto dto)
    {
        if (dto.BaseAmount <= 0)
            return BadRequest(new { message = "BaseAmount phải lớn hơn 0." });

        if (dto.DaysDuration < 1) dto.DaysDuration = 1;

        _ = TryGetCurrentUserId(out var previewUserId);
        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg) = await CalculateDiscountAsync(dto.VenueId, dto.BaseAmount, dto.DaysDuration, dto.CouponCode, previewUserId);

        // We don't block the request if there is an error in calculating coupon (e.g. invalid coupon), 
        // we just return the errorMsg in response so FE can handle it (show text "Mã không hợp lệ" etc).
        // If errorMsg is purely "Venue not found", we can return BadRequest.
        if (errorMsg == "Venue not found")
            return BadRequest(new { message = "Cơ sở không tồn tại." });

        return Ok(new
        {
            baseAmount = dto.BaseAmount,
            discountAmount,
            finalAmount,
            isValidCoupon = couponId != null,
            errorMsg
        });
    }

    private async Task<(decimal DiscountAmount, decimal FinalAmount, Guid? CouponId, ShuttleUp.DAL.Models.VenueCoupon? CouponToUpdate, string? ErrorMsg)> CalculateDiscountAsync(
        Guid venueId,
        decimal totalAmount,
        int daysDuration,
        string? couponCode,
        Guid? userIdForCouponCheck)
    {
        var venue = await _dbContext.Venues.AsNoTracking().FirstOrDefaultAsync(v => v.Id == venueId);
        if (venue == null) return (0, totalAmount, null, null, "Venue not found");

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
                return (0, totalAmount, null, null, "Mã giảm giá không hợp lệ hoặc đã bị khóa.");

            var now = DateTime.UtcNow;
            if (now < coupon.StartDate || now > coupon.EndDate)
                return (0, totalAmount, null, null, "Mã giảm giá không trong thời gian sử dụng.");

            if (coupon.MinBookingValue > 0 && finalAmount < coupon.MinBookingValue)
                return (0, totalAmount, null, null, $"Mã giảm giá yêu cầu giá trị đơn tối thiểu {coupon.MinBookingValue:N0} VNĐ (sau khi đã trừ tự động).");

            if (coupon.UsageLimit.HasValue && (coupon.UsedCount ?? 0) >= coupon.UsageLimit.Value)
                return (0, totalAmount, null, null, "Mã giảm giá đã hết lượt sử dụng.");

            if (coupon.OneUsePerUser && userIdForCouponCheck is { } uid && uid != Guid.Empty)
            {
                var alreadyUsed = await _dbContext.Bookings.AsNoTracking()
                    .AnyAsync(b => b.UserId == uid
                        && b.CouponId == coupon.Id
                        && b.Status != null
                        && b.Status != "CANCELLED");
                if (alreadyUsed)
                    return (0, totalAmount, null, null, "Mã này chỉ dùng được một lần cho mỗi tài khoản. Bạn đã sử dụng trước đó.");
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

        return (discountAmount, finalAmount, couponId, couponToUpdate, null);
    }
}
    

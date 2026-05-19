using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using ShuttleUp.BLL.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShuttleUp.BLL.Services;

public class BookingCreationService : IBookingCreationService
{
    private readonly IVenueRepository _venueRepository;
    private readonly ICourtRepository _courtRepository;
    private readonly IVenueCouponRepository _couponRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IBookingValidationService _validationService;
    private readonly ShuttleUpDbContext _dbContext; // ONLY FOR TRANSACTION

    public BookingCreationService(
        IVenueRepository venueRepository,
        ICourtRepository courtRepository,
        IVenueCouponRepository couponRepository,
        IBookingRepository bookingRepository,
        IBookingValidationService validationService,
        ShuttleUpDbContext dbContext)
    {
        _venueRepository = venueRepository;
        _courtRepository = courtRepository;
        _couponRepository = couponRepository;
        _bookingRepository = bookingRepository;
        _validationService = validationService;
        _dbContext = dbContext;
    }

    public async Task<BookingResponseDto> UpdateHoldingBookingContactAsync(Guid bookingId, Guid userId, string contactName, string contactPhone, string? note, CancellationToken ct)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.UserId != userId)
            throw new UnauthorizedAccessException("Bạn không có quyền sửa đơn này.");

        if (booking.Status != "HOLDING")
            throw new ArgumentException("Chỉ có thể cập nhật đơn đang giữ chỗ (HOLDING).");

        if (booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Thời gian giữ chỗ đã hết. Vui lòng đặt lại.");

        booking.ContactName = contactName.Trim();
        booking.ContactPhone = contactPhone.Trim();
        booking.GuestNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        var holdExpiry = DateTime.UtcNow.AddMinutes(5);
        booking.HoldExpiresAt = holdExpiry;

        await _bookingRepository.UpdateAsync(booking);

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        return new BookingResponseDto
        {
            BookingId = booking.Id,
            BookingCode = code,
            Status = booking.Status,
            HoldExpiresAt = holdExpiry,
            TotalAmount = booking.TotalAmount ?? 0,
            FinalAmount = booking.FinalAmount ?? 0,
            Items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = bi.Court?.Name,
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList(),
        };
    }

    public async Task<BookingResponseDto> CreateBookingAsync(Guid userId, CreateBookingRequestDto dto, CancellationToken ct)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("Vui lòng chọn ít nhất một khung giờ.");

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null || venue.IsActive == false)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync(ct);

        if (courts.Count != courtIds.Count)
            throw new ArgumentException("Một hoặc nhiều sân không thuộc cơ sở này.");

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById, venue.SlotDuration);
        if (normErr != null)
            throw new ArgumentException(normErr);

        var conflict = await _validationService.CheckSlotConflictsAsync(courtIds, normalizedItems, ct, excludeBookingId: dto.BookingId, excludeHoldingUserId: userId);
        if (conflict == "CONFLICT_BOOKING")
            throw new InvalidOperationException("Một hoặc nhiều khung giờ vừa được người khác đặt. Vui lòng chọn lại.");
        if (conflict == "CONFLICT_BLOCK")
            throw new InvalidOperationException("Một số khung giờ đang bị khóa bởi chủ sân.");

        var openHoursErr = await _validationService.CheckOpenHoursAsync(normalizedItems, ct);
        if (openHoursErr == "COURT_CLOSED_DAY")
            throw new ArgumentException("Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác.");
        if (openHoursErr == "OUTSIDE_OPEN_HOURS")
            throw new ArgumentException("Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác.");

        var total = normalizedItems.Sum(x => x.Price);
        var bookedDates = normalizedItems.Select(x => x.Start).ToList();

        VenueCoupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
        {
            coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.VenueId == dto.VenueId && c.Code == dto.CouponCode.Trim().ToUpperInvariant() && c.IsActive == true, ct);
        }

        bool hasUserUsedCoupon = false;
        if (coupon != null && coupon.OneUsePerUser)
        {
             hasUserUsedCoupon = await _dbContext.Bookings.AsNoTracking()
                    .AnyAsync(b => b.UserId == userId
                        && b.CouponId == coupon.Id
                        && b.Status != null
                        && b.Status != "CANCELLED", ct);
        }

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = DiscountHelper.CalculateDiscount(venue, total, bookedDates, dto.CouponCode, coupon, hasUserUsedCoupon);
        if (errorMsg != null) throw new ArgumentException(errorMsg);

        var policySnapshot = new
        {
            AllowCancel = venue.CancelAllowed,
            CancelBeforeMinutes = venue.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venue.RefundType) ? "NONE" : venue.RefundType!,
            RefundPercent = venue.RefundPercent,
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

        await using var trx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
            _dbContext.Bookings.Add(booking);
            await _dbContext.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        }
        catch
        {
            await trx.RollbackAsync(ct);
            throw;
        }

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        return new BookingResponseDto
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
    }

    public async Task<BookingResponseDto> CreateLongTermBookingAsync(Guid userId, LongTermBookingRequestDto dto, CancellationToken ct)
    {
        var built = await _validationService.BuildLongTermNormalizedAsync(dto, userId, ct);

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null || venue.IsActive == false)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        decimal total = 0;
        DateTime minStart;
        DateTime maxEnd;

        if (built.SmartItems != null)
        {
            var availableItems = built.SmartItems.Where(x => !x.IsUnavailable && x.CourtId.HasValue).ToList();
            if (availableItems.Count == 0)
                throw new ArgumentException("Không có khung giờ nào khả dụng để đặt.");

            total = availableItems.Sum(x => x.Price);
            minStart = availableItems.Min(x => x.Start);
            maxEnd = availableItems.Max(x => x.End);
        }
        else
        {
            if (built.NormalizedItems == null || built.NormalizedItems.Count == 0)
                throw new ArgumentException("Không có khung giờ hợp lệ.");

            total = built.NormalizedItems.Sum(x => x.Price);
            minStart = built.NormalizedItems.Min(x => x.Start);
            maxEnd = built.NormalizedItems.Max(x => x.End);
        }

        List<DateTime> bookedDates;
        if (built.SmartItems != null)
            bookedDates = built.SmartItems.Where(x => !x.IsUnavailable && x.CourtId.HasValue).Select(x => x.Start).ToList();
        else
            bookedDates = built.NormalizedItems!.Select(x => x.Start).ToList();

        VenueCoupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
        {
            coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.VenueId == dto.VenueId && c.Code == dto.CouponCode.Trim().ToUpperInvariant() && c.IsActive == true, ct);
        }
        bool hasUserUsedCoupon = false;
        if (coupon != null && coupon.OneUsePerUser)
        {
             hasUserUsedCoupon = await _dbContext.Bookings.AsNoTracking().AnyAsync(b => b.UserId == userId && b.CouponId == coupon.Id && b.Status != "CANCELLED", ct);
        }

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = DiscountHelper.CalculateDiscount(venue, total, bookedDates, dto.CouponCode, coupon, hasUserUsedCoupon);
        if (errorMsg != null) throw new ArgumentException(errorMsg);

        var policySnapshot = new
        {
            AllowCancel = venue.CancelAllowed,
            CancelBeforeMinutes = venue.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venue.RefundType) ? "NONE" : venue.RefundType!,
            RefundPercent = venue.RefundPercent,
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
            RangeStartDate = built.RangeStart,
            RangeEndDate = built.RangeEnd,
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

        await using var trx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
            _dbContext.BookingSeries.Add(series);
            _dbContext.Bookings.Add(booking);
            await _dbContext.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        }
        catch
        {
            await trx.RollbackAsync(ct);
            throw;
        }

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        
        Dictionary<Guid, string> courtNames = new();
        if (built.SmartItems != null)
        {
            foreach (var si in built.SmartItems.Where(x => x.CourtId.HasValue))
                courtNames[si.CourtId!.Value] = si.CourtName ?? "—";
        }
        else if (built.Court != null)
        {
            courtNames[built.Court.Id] = built.Court.Name;
        }

        return new BookingResponseDto
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
                CourtName = courtNames.GetValueOrDefault(bi.CourtId ?? Guid.Empty),
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList()
        };
    }

    public async Task<BookingResponseDto> CreateLongTermFlexibleBookingAsync(Guid userId, LongTermFlexibleBookingRequestDto dto, CancellationToken ct)
    {
        var built = await _validationService.BuildFlexibleLongTermAsync(dto, userId, ct);

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null || venue.IsActive == false)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        var normalizedItems = built.NormalizedItems;
        var total = normalizedItems.Sum(x => x.Price);
        var bookedDates = normalizedItems.Select(x => x.Start).ToList();

        VenueCoupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
        {
            coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.VenueId == dto.VenueId && c.Code == dto.CouponCode.Trim().ToUpperInvariant() && c.IsActive == true, ct);
        }
        bool hasUserUsedCoupon = false;
        if (coupon != null && coupon.OneUsePerUser)
        {
             hasUserUsedCoupon = await _dbContext.Bookings.AsNoTracking().AnyAsync(b => b.UserId == userId && b.CouponId == coupon.Id && b.Status != "CANCELLED", ct);
        }

        var (discountAmount, finalAmount, couponId, couponToUpdate, errorMsg, _, _) = DiscountHelper.CalculateDiscount(venue, total, bookedDates, dto.CouponCode, coupon, hasUserUsedCoupon);
        if (errorMsg != null) throw new ArgumentException(errorMsg);

        var policySnapshot = new
        {
            AllowCancel = venue.CancelAllowed,
            CancelBeforeMinutes = venue.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venue.RefundType) ? "NONE" : venue.RefundType!,
            RefundPercent = venue.RefundPercent,
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
            RangeStartDate = built.RangeStart,
            RangeEndDate = built.RangeEnd,
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

        await using var trx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            if (couponToUpdate != null)
            {
                couponToUpdate.UsedCount = (couponToUpdate.UsedCount ?? 0) + 1;
                _dbContext.VenueCoupons.Update(couponToUpdate);
            }
            _dbContext.BookingSeries.Add(series);
            _dbContext.Bookings.Add(booking);
            await _dbContext.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        }
        catch
        {
            await trx.RollbackAsync(ct);
            throw;
        }

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        var courtById = built.CourtById;

        return new BookingResponseDto
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
    }
}

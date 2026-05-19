using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
// BookingSlotHelper is in ShuttleUp.BLL.Helpers now
using ShuttleUp.BLL.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace ShuttleUp.BLL.Services;

public class BookingValidationService : IBookingValidationService
{
    private readonly ShuttleUpDbContext _dbContext;

    // Inject DbContext temporarily ONLY for BookingSlotHelper complex queries until it gets fully refactored
    public BookingValidationService(ShuttleUpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<string?> CheckSlotConflictsAsync(List<Guid> courtIds, List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems, CancellationToken ct = default, Guid? excludeBookingId = null, Guid? excludeHoldingUserId = null)
    {
        return await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct, excludeBookingId, excludeHoldingUserId);
    }

    public async Task<string?> CheckOpenHoursAsync(List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems, CancellationToken ct = default)
    {
        return await BookingSlotHelper.CheckOpenHoursAsync(_dbContext, normalizedItems, ct);
    }

    public async Task<FlexibleLongTermBuildResultDto> BuildFlexibleLongTermAsync(LongTermFlexibleScheduleDto dto, Guid? currentUserId, CancellationToken ct)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("Vui lòng chọn ít nhất một khung giờ.");

        var venueOk = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.Id == dto.VenueId && v.IsActive == true)
            .Select(v => new { v.Id, v.SlotDuration })
            .FirstOrDefaultAsync(ct);

        if (venueOk == null)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync(ct);

        if (courts.Count != courtIds.Count)
            throw new ArgumentException("Một hoặc nhiều sân không thuộc cơ sở này.");

        var courtById = courts.ToDictionary(c => c.Id);

        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById, venueOk.SlotDuration);
        if (normErr != null)
            throw new ArgumentException(normErr);

        if (normalizedItems.Count > BookingSlotHelper.MaxLongTermSlots)
            throw new ArgumentException($"Vượt quá số khung tối đa ({BookingSlotHelper.MaxLongTermSlots} ô × {venueOk.SlotDuration} phút).");

        var conflict = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict == "CONFLICT_BOOKING")
            throw new InvalidOperationException("Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch.");
        if (conflict == "CONFLICT_BLOCK")
            throw new InvalidOperationException("Một số khung giờ đang bị khóa bởi chủ sân.");

        var openHoursErr = await BookingSlotHelper.CheckOpenHoursAsync(_dbContext, normalizedItems, ct);
        if (openHoursErr == "COURT_CLOSED_DAY")
            throw new ArgumentException("Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác.");
        if (openHoursErr == "OUTSIDE_OPEN_HOURS")
            throw new ArgumentException("Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác.");

        var dates = normalizedItems.Select(x => DateOnly.FromDateTime(x.Start));
        var rangeStart = dates.Min();
        var rangeEnd = dates.Max();

        return new FlexibleLongTermBuildResultDto
        {
            NormalizedItems = normalizedItems,
            CourtById = courtById,
            RangeStart = rangeStart,
            RangeEnd = rangeEnd,
        };
    }

    public async Task<LongTermBuildResultDto> BuildLongTermNormalizedAsync(LongTermScheduleDto dto, Guid? currentUserId, CancellationToken ct)
    {
        var (rs, re, st, et, parseErr) = BookingSlotHelper.ParseLongTermSchedule(dto);
        if (parseErr != null)
            throw new ArgumentException(parseErr);

        var (dayFilter, dayErr) = BookingSlotHelper.ParseDaysOfWeek(dto.DaysOfWeek);
        if (dayErr != null)
            throw new ArgumentException(dayErr);

        var venueInfo = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.Id == dto.VenueId && v.IsActive == true)
            .Select(v => new { v.Id, v.SlotDuration })
            .FirstOrDefaultAsync(ct);

        if (venueInfo == null)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        bool useSmartAllocation = !dto.CourtId.HasValue || dto.AutoSwitchCourt;

        // ── SMART ALLOCATION PATH ──
        if (useSmartAllocation)
        {
            var allCourts = await _dbContext.Courts
                .Include(c => c.CourtPrices)
                .Where(c => c.VenueId == dto.VenueId && c.IsActive == true && c.Status == "ACTIVE")
                .ToListAsync(ct);

            if (allCourts.Count == 0)
                throw new ArgumentException("Cơ sở chưa có sân nào hoạt động.");

            List<(DateTime Start, DateTime End)> timeSlots;
            string? expandErr;

            if (dto.DailySchedules != null && dto.DailySchedules.Count > 0)
            {
                var dayTimeMap = new Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)>();
                foreach (var ds in dto.DailySchedules)
                {
                    if (ds.DayOfWeek < 0 || ds.DayOfWeek > 6)
                        throw new ArgumentException("DailySchedules chứa DayOfWeek không hợp lệ (0-6).");
                    if (!TimeOnly.TryParse(ds.StartTime, out var dsStart))
                        throw new ArgumentException($"StartTime không hợp lệ cho ngày {ds.DayOfWeek}.");
                    if (!TimeOnly.TryParse(ds.EndTime, out var dsEnd))
                        throw new ArgumentException($"EndTime không hợp lệ cho ngày {ds.DayOfWeek}.");
                    dayTimeMap[(DayOfWeek)ds.DayOfWeek] = (dsStart, dsEnd);
                }
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlotsWithDailySchedules(rs, re, dayTimeMap, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
            }
            else
            {
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlots(rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots, venueInfo.SlotDuration);
            }

            if (expandErr != null)
                throw new ArgumentException(expandErr);

            var pricePreference = string.IsNullOrWhiteSpace(dto.PricePreference) ? "BEST" : dto.PricePreference.Trim().ToUpperInvariant();

            var (smartItems, smartErr) = await BookingSlotHelper.AllocateFlexibleLongTerm(
                _dbContext, allCourts, timeSlots, dto.CourtId, pricePreference, ct);

            if (smartErr != null && smartItems.All(x => x.IsUnavailable))
                throw new InvalidOperationException(smartErr);

            return new LongTermBuildResultDto
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
            throw new ArgumentException("Sân không thuộc cơ sở hoặc không hoạt động.");

        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems;
        string? legacyExpandErr;

        if (dto.DailySchedules != null && dto.DailySchedules.Count > 0)
        {
            var dayTimeMap = new Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)>();
            foreach (var ds in dto.DailySchedules)
            {
                if (ds.DayOfWeek < 0 || ds.DayOfWeek > 6)
                    throw new ArgumentException("DailySchedules chứa DayOfWeek không hợp lệ (0-6).");
                if (!TimeOnly.TryParse(ds.StartTime, out var dsStart))
                    throw new ArgumentException($"StartTime không hợp lệ cho ngày {ds.DayOfWeek}.");
                if (!TimeOnly.TryParse(ds.EndTime, out var dsEnd))
                    throw new ArgumentException($"EndTime không hợp lệ cho ngày {ds.DayOfWeek}.");
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
            throw new ArgumentException(legacyExpandErr);

        var courtIds = new List<Guid> { dto.CourtId!.Value };
        var conflict2 = await BookingSlotHelper.CheckSlotConflictsAsync(_dbContext, courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict2 == "CONFLICT_BOOKING")
            throw new InvalidOperationException("Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch.");
        if (conflict2 == "CONFLICT_BLOCK")
            throw new InvalidOperationException("Một số khung giờ đang bị khóa bởi chủ sân.");

        var openHoursErr2 = await BookingSlotHelper.CheckOpenHoursAsync(_dbContext, normalizedItems, ct);
        if (openHoursErr2 == "COURT_CLOSED_DAY")
            throw new ArgumentException("Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác.");
        if (openHoursErr2 == "OUTSIDE_OPEN_HOURS")
            throw new ArgumentException("Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác.");

        return new LongTermBuildResultDto
        {
            NormalizedItems = normalizedItems,
            Court = court,
            RangeStart = rs,
            RangeEnd = re,
            SessionStart = st,
            SessionEnd = et,
        };
    }
}

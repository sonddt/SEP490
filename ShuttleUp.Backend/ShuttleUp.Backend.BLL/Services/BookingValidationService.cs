using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.BLL.Helpers;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class BookingValidationService : IBookingValidationService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IVenueRepository _venueRepository;
    private readonly ICourtRepository _courtRepository;

    public BookingValidationService(
        IBookingRepository bookingRepository,
        IVenueRepository venueRepository,
        ICourtRepository courtRepository)
    {
        _bookingRepository = bookingRepository;
        _venueRepository = venueRepository;
        _courtRepository = courtRepository;
    }

    public Task<string?> CheckSlotConflictsAsync(
        List<Guid> courtIds,
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default,
        Guid? excludeBookingId = null,
        Guid? excludeHoldingUserId = null)
        => _bookingRepository.CheckSlotConflictsAsync(courtIds, normalizedItems, ct, excludeBookingId, excludeHoldingUserId);

    public Task<string?> CheckOpenHoursAsync(
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default)
        => _bookingRepository.CheckOpenHoursAsync(normalizedItems, ct);

    public async Task<FlexibleLongTermBuildResultDto> BuildFlexibleLongTermAsync(LongTermFlexibleScheduleDto dto, Guid? currentUserId, CancellationToken ct)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("Vui lòng chọn ít nhất một khung giờ.");

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null || venue.IsActive == false)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        var courtIds = dto.Items.Select(i => i.CourtId).Distinct().ToList();
        var courts = await _courtRepository.GetByVenueWithPricesAndFilesAsync(dto.VenueId);
        courts = courts.Where(c => courtIds.Contains(c.Id) && c.IsActive == true && c.Status == "ACTIVE").ToList();

        if (courts.Count != courtIds.Count)
            throw new ArgumentException("Một hoặc nhiều sân không thuộc cơ sở này.");

        var courtById = courts.ToDictionary(c => c.Id);
        var (normalizedItems, normErr) = BookingSlotHelper.NormalizeFromCreateItems(dto.Items, courtById, venue.SlotDuration);
        if (normErr != null)
            throw new ArgumentException(normErr);

        if (normalizedItems.Count > BookingSlotHelper.MaxLongTermSlots)
            throw new ArgumentException($"Vượt quá số khung tối đa ({BookingSlotHelper.MaxLongTermSlots} ô × {venue.SlotDuration} phút).");

        var conflict = await _bookingRepository.CheckSlotConflictsAsync(courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict == "CONFLICT_BOOKING")
            throw new InvalidOperationException("Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch.");
        if (conflict == "CONFLICT_BLOCK")
            throw new InvalidOperationException("Một số khung giờ đang bị khóa bởi chủ sân.");

        var openHoursErr = await _bookingRepository.CheckOpenHoursAsync(normalizedItems, ct);
        if (openHoursErr == "COURT_CLOSED_DAY")
            throw new ArgumentException("Sân không mở cửa vào ngày này. Vui lòng chọn ngày khác.");
        if (openHoursErr == "OUTSIDE_OPEN_HOURS")
            throw new ArgumentException("Khung giờ nằm ngoài giờ nhận khách của sân. Vui lòng chọn khung giờ khác.");

        var dates = normalizedItems.Select(x => DateOnly.FromDateTime(x.Start));
        return new FlexibleLongTermBuildResultDto
        {
            NormalizedItems = normalizedItems,
            CourtById = courtById,
            RangeStart = dates.Min(),
            RangeEnd = dates.Max(),
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

        var venue = await _venueRepository.GetByIdAsync(dto.VenueId);
        if (venue == null || venue.IsActive == false)
            throw new ArgumentException("Cơ sở không tồn tại hoặc chưa mở đặt sân.");

        bool useSmartAllocation = !dto.CourtId.HasValue || dto.AutoSwitchCourt;

        if (useSmartAllocation)
        {
            var allCourts = await _courtRepository.GetByVenueWithPricesAndFilesAsync(dto.VenueId);
            allCourts = allCourts.Where(c => c.IsActive == true && c.Status == "ACTIVE").ToList();

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
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlotsWithDailySchedules(rs, re, dayTimeMap, BookingSlotHelper.MaxLongTermSlots, venue.SlotDuration);
            }
            else
            {
                (timeSlots, expandErr) = BookingSlotHelper.ExpandTimeSlots(rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots, venue.SlotDuration);
            }

            if (expandErr != null)
                throw new ArgumentException(expandErr);

            var pricePreference = string.IsNullOrWhiteSpace(dto.PricePreference) ? "BEST" : dto.PricePreference.Trim().ToUpperInvariant();
            var (smartRows, smartErr) = await _bookingRepository.AllocateFlexibleLongTermAsync(
                allCourts, timeSlots, dto.CourtId, pricePreference, ct);

            if (smartErr != null && smartRows.All(x => x.IsUnavailable))
                throw new InvalidOperationException(smartErr);

            return new LongTermBuildResultDto
            {
                SmartItems = smartRows.Select(r => new SmartAllocationItemDto(
                    r.CourtId, r.CourtName, r.Start, r.End, r.Price, r.IsUnavailable, r.IsSwitched, r.SwitchReason)).ToList(),
                RangeStart = rs,
                RangeEnd = re,
                SessionStart = st,
                SessionEnd = et,
            };
        }

        var court = await _courtRepository.GetInVenueAsync(dto.VenueId, dto.CourtId!.Value);
        if (court == null || court.IsActive != true || court.Status != "ACTIVE")
            throw new ArgumentException("Sân không thuộc cơ sở hoặc không hoạt động.");

        var prices = await _courtRepository.GetCourtPricesAsync(court.Id);
        court.CourtPrices = prices;

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
                dto.CourtId!.Value, court, rs, re, dayTimeMap, BookingSlotHelper.MaxLongTermSlots, venue.SlotDuration);
        }
        else
        {
            (normalizedItems, legacyExpandErr) = BookingSlotHelper.ExpandWeeklyLongTerm(
                dto.CourtId!.Value, court, rs, re, dayFilter, st, et, BookingSlotHelper.MaxLongTermSlots, venue.SlotDuration);
        }

        if (legacyExpandErr != null)
            throw new ArgumentException(legacyExpandErr);

        var courtIds = new List<Guid> { dto.CourtId!.Value };
        var conflict2 = await _bookingRepository.CheckSlotConflictsAsync(courtIds, normalizedItems, ct, excludeBookingId: null, excludeHoldingUserId: currentUserId);
        if (conflict2 == "CONFLICT_BOOKING")
            throw new InvalidOperationException("Một hoặc nhiều khung giờ đã có người đặt. Vui lòng đổi lịch.");
        if (conflict2 == "CONFLICT_BLOCK")
            throw new InvalidOperationException("Một số khung giờ đang bị khóa bởi chủ sân.");

        var openHoursErr2 = await _bookingRepository.CheckOpenHoursAsync(normalizedItems, ct);
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

using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public partial class BookingRepository
{
    public async Task<string?> CheckSlotConflictsAsync(
        List<Guid> courtIds,
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default,
        Guid? excludeBookingId = null,
        Guid? excludeHoldingUserId = null)
    {
        if (normalizedItems.Count == 0)
            return null;

        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);
        var now = DateTime.UtcNow;

        var query = _context.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && courtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null
                         && bi.Booking.Status != "CANCELLED");

        if (excludeBookingId.HasValue)
            query = query.Where(bi => bi.BookingId != excludeBookingId.Value);

        if (excludeHoldingUserId != null)
        {
            query = query.Where(bi =>
                bi.Booking!.Status != "HOLDING" ||
                bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now && bi.Booking.UserId != excludeHoldingUserId);
        }
        else
        {
            query = query.Where(bi =>
                bi.Booking!.Status != "HOLDING" ||
                bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now);
        }

        var existingItems = await query.ToListAsync(ct);

        foreach (var bi in existingItems)
        {
            foreach (var ni in normalizedItems)
            {
                if (ni.CourtId != bi.CourtId || bi.StartTime == null || bi.EndTime == null)
                    continue;
                if (bi.StartTime < ni.End && bi.EndTime > ni.Start)
                    return "CONFLICT_BOOKING";
            }
        }

        var blocks = await _context.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && courtIds.Contains(b.CourtId.Value)
                                            && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync(ct);

        foreach (var b in blocks)
        {
            foreach (var ni in normalizedItems)
            {
                if (ni.CourtId != b.CourtId || b.StartTime == null || b.EndTime == null)
                    continue;
                if (b.StartTime < ni.End && b.EndTime > ni.Start)
                    return "CONFLICT_BLOCK";
            }
        }

        return null;
    }

    public async Task<string?> CheckOpenHoursAsync(
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken ct = default)
    {
        if (normalizedItems.Count == 0)
            return null;

        var courtIds = normalizedItems.Select(x => x.CourtId).Distinct().ToList();

        var allOpenHours = await _context.CourtOpenHours
            .AsNoTracking()
            .Where(o => o.CourtId != null && courtIds.Contains(o.CourtId.Value))
            .ToListAsync(ct);

        var configuredCourtIds = allOpenHours
            .Select(o => o.CourtId!.Value)
            .Distinct()
            .ToHashSet();

        foreach (var item in normalizedItems)
        {
            if (!configuredCourtIds.Contains(item.CourtId))
                return "COURT_CLOSED_DAY";

            var dayOfWeek = (int)item.Start.DayOfWeek;
            var record = allOpenHours.FirstOrDefault(o =>
                o.CourtId == item.CourtId && o.DayOfWeek == dayOfWeek);

            if (record == null || !record.OpenTime.HasValue || !record.CloseTime.HasValue)
                return "COURT_CLOSED_DAY";

            var startTs = item.Start.TimeOfDay;
            var endTs = item.End.TimeOfDay;
            // Handle midnight case (end time is exactly 00:00 of the next day)
            if (endTs == TimeSpan.Zero && item.End > item.Start)
            {
                endTs = TimeSpan.FromHours(24);
            }

            var openTs = record.OpenTime.Value.ToTimeSpan();
            var closeTs = record.CloseTime.Value.ToTimeSpan();
            // If close time is 23:59:00, we treat it as 24:00:00 to allow booking until midnight
            if (closeTs == new TimeSpan(23, 59, 0) || closeTs == new TimeSpan(23, 59, 59))
            {
                closeTs = TimeSpan.FromHours(24);
            }

            if (startTs < openTs || endTs > closeTs)
                return "OUTSIDE_OPEN_HOURS";
        }

        return null;
    }

    public async Task<(List<SmartAllocationRow> Items, string? Error)> AllocateFlexibleLongTermAsync(
        List<Court> allCourts,
        List<(DateTime Start, DateTime End)> requestedSlots,
        Guid? preferredCourtId,
        string pricePreference,
        CancellationToken ct = default)
    {
        if (requestedSlots.Count == 0)
            return (new List<SmartAllocationRow>(), "Không có buổi nào khớp điều kiện.");
        if (allCourts.Count == 0)
            return (new List<SmartAllocationRow>(), "Cơ sở chưa có sân nào hoạt động.");

        var minStart = requestedSlots.Min(s => s.Start);
        var maxEnd = requestedSlots.Max(s => s.End);
        var allCourtIds = allCourts.Select(c => c.Id).ToList();
        var now = DateTime.UtcNow;

        var existingBookings = await _context.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && allCourtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null
                         && bi.Booking.Status != "CANCELLED"
                         && (bi.Booking.Status != "HOLDING"
                             || bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now))
            .ToListAsync(ct);

        var existingBlocks = await _context.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && allCourtIds.Contains(b.CourtId.Value)
                        && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync(ct);

        var allOpenHours = await _context.CourtOpenHours
            .AsNoTracking()
            .Where(o => o.CourtId != null && allCourtIds.Contains(o.CourtId.Value))
            .ToListAsync(ct);

        var configuredCourtIds = allOpenHours.Select(o => o.CourtId!.Value).Distinct().ToHashSet();
        var busyMap = new Dictionary<Guid, HashSet<(DateTime, DateTime)>>();
        foreach (var cid in allCourtIds) busyMap[cid] = new HashSet<(DateTime, DateTime)>();

        foreach (var bi in existingBookings)
        {
            if (bi.CourtId != null && bi.StartTime != null && bi.EndTime != null)
                busyMap[bi.CourtId.Value].Add((bi.StartTime.Value, bi.EndTime.Value));
        }
        foreach (var b in existingBlocks)
        {
            if (b.CourtId != null && b.StartTime != null && b.EndTime != null)
                busyMap[b.CourtId.Value].Add((b.StartTime.Value, b.EndTime.Value));
        }

        bool IsSlotFree(Guid courtId, DateTime start, DateTime end)
        {
            if (configuredCourtIds.Contains(courtId))
            {
                var dayOfWeek = (int)start.DayOfWeek;
                var record = allOpenHours.FirstOrDefault(o => o.CourtId == courtId && o.DayOfWeek == dayOfWeek);
                if (record != null)
                {
                    if (!record.OpenTime.HasValue || !record.CloseTime.HasValue)
                        return false;
                    
                    var startTs = start.TimeOfDay;
                    var endTs = end.TimeOfDay;
                    if (endTs == TimeSpan.Zero && end > start) endTs = TimeSpan.FromHours(24);

                    var openTs = record.OpenTime.Value.ToTimeSpan();
                    var closeTs = record.CloseTime.Value.ToTimeSpan();
                    if (closeTs == new TimeSpan(23, 59, 0) || closeTs == new TimeSpan(23, 59, 59)) closeTs = TimeSpan.FromHours(24);

                    if (startTs < openTs || endTs > closeTs)
                        return false;
                }
            }

            if (!busyMap.TryGetValue(courtId, out var set)) return true;
            foreach (var (bs, be) in set)
            {
                if (bs < end && be > start) return false;
            }
            return true;
        }

        decimal? budgetPriceCap = null;
        if (pricePreference == "BUDGET" && preferredCourtId.HasValue)
        {
            var prefCourt = allCourts.FirstOrDefault(c => c.Id == preferredCourtId.Value);
            if (prefCourt != null)
                budgetPriceCap = prefCourt.CourtPrices.Where(p => p.Price.HasValue).Max(p => p.Price!.Value);
        }
        else if (pricePreference == "BUDGET" && !preferredCourtId.HasValue)
        {
            budgetPriceCap = allCourts
                .Where(c => c.CourtPrices.Any(p => p.Price.HasValue))
                .Select(c => c.CourtPrices.Where(p => p.Price.HasValue).Max(p => p.Price!.Value))
                .DefaultIfEmpty(0)
                .Min();
        }

        var candidateCourts = allCourts.ToList();
        if (budgetPriceCap.HasValue && budgetPriceCap > 0)
        {
            candidateCourts = allCourts
                .Where(c => c.CourtPrices.Any(p => p.Price.HasValue && p.Price.Value <= budgetPriceCap.Value))
                .ToList();
            if (candidateCourts.Count == 0)
                candidateCourts = allCourts.ToList();
        }

        var orderedCandidates = preferredCourtId.HasValue
            ? candidateCourts.OrderByDescending(c => c.Id == preferredCourtId.Value).ToList()
            : candidateCourts;

        foreach (var court in orderedCandidates)
        {
            if (requestedSlots.All(s => IsSlotFree(court.Id, s.Start, s.End)))
            {
                var items = new List<SmartAllocationRow>();
                foreach (var slot in requestedSlots)
                {
                    var price = ResolveSlotPrice(court.CourtPrices.ToList(), slot.Start);
                    if (price == null)
                        return (new List<SmartAllocationRow>(), $"Chưa cấu hình giá cho sân {court.Name} tại {slot.Start:HH:mm}.");
                    items.Add(new SmartAllocationRow(court.Id, court.Name, slot.Start, slot.End, price.Value,
                        false, false, null));
                }
                return (items, null);
            }
        }

        var primaryCourtId = preferredCourtId ?? orderedCandidates.FirstOrDefault()?.Id;
        var assignCounts = new Dictionary<Guid, int>();
        foreach (var c in candidateCourts) assignCounts[c.Id] = 0;

        var result = new List<SmartAllocationRow>();
        foreach (var slot in requestedSlots)
        {
            SmartAllocationRow? assigned = null;
            var sortedCourts = candidateCourts
                .Where(c => IsSlotFree(c.Id, slot.Start, slot.End))
                .OrderByDescending(c => c.Id == primaryCourtId)
                .ThenByDescending(c => assignCounts.GetValueOrDefault(c.Id, 0))
                .ToList();

            foreach (var court in sortedCourts)
            {
                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slot.Start);
                if (price == null) continue;

                var isSwitched = court.Id != primaryCourtId;
                var reason = isSwitched ? $"Sân chính đã kín. Hệ thống chuyển sang {court.Name}." : null;
                assigned = new SmartAllocationRow(court.Id, court.Name, slot.Start, slot.End, price.Value,
                    false, isSwitched, reason);
                assignCounts[court.Id] = assignCounts.GetValueOrDefault(court.Id, 0) + 1;
                busyMap[court.Id].Add((slot.Start, slot.End));
                break;
            }

            if (assigned != null)
                result.Add(assigned);
            else
                result.Add(new SmartAllocationRow(null, null, slot.Start, slot.End, 0, true, false, null));
        }

        if (result.All(r => r.IsUnavailable))
            return (result, "Tất cả khung giờ đã kín trên mọi sân. Vui lòng đổi thời gian.");

        return (result, null);
    }

    private static decimal? ResolveSlotPrice(IReadOnlyCollection<CourtPrice> prices, DateTime slotStart)
    {
        var weekend = slotStart.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
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
}

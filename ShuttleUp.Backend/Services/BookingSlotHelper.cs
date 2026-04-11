using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

/// <summary>Chuẩn hoá slot 30 phút, giá và kiểm tra trùng — dùng chung đặt lẻ và đặt dài hạn.</summary>
public static class BookingSlotHelper
{
    public const int MaxLongTermSlots = 400;

    public static (HashSet<DayOfWeek> Days, string? Error) ParseDaysOfWeek(IList<int>? raw)
    {
        if (raw == null || raw.Count == 0)
            return (new HashSet<DayOfWeek>(), "Chọn ít nhất một thứ trong tuần.");

        var set = new HashSet<DayOfWeek>();
        foreach (var x in raw.Distinct())
        {
            if (x < 0 || x > 6)
                return (set, "daysOfWeek phải từ 0 (Chủ nhật) đến 6 (Thứ bảy).");
            set.Add((DayOfWeek)x);
        }

        return (set, null);
    }

    public static (DateOnly RangeStart, DateOnly RangeEnd, TimeOnly SessionStart, TimeOnly SessionEnd, string? Error)
        ParseLongTermSchedule(LongTermScheduleDto dto)
    {
        if (!DateOnly.TryParse(dto.RangeStart, out var rs))
            return (default, default, default, default, "rangeStart không hợp lệ (yyyy-MM-dd).");
        if (!DateOnly.TryParse(dto.RangeEnd, out var re))
            return (default, default, default, default, "rangeEnd không hợp lệ (yyyy-MM-dd).");
        if (!TimeOnly.TryParse(dto.SessionStartTime, out var st))
            return (default, default, default, default, "sessionStartTime không hợp lệ (HH:mm).");
        if (!TimeOnly.TryParse(dto.SessionEndTime, out var et))
            return (default, default, default, default, "sessionEndTime không hợp lệ (HH:mm).");
        return (rs, re, st, et, null);
    }

    public static bool IsWeekendDate(DateTime d) =>
        d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    /// <summary>Giá một khung 30 phút (VNĐ / 30 phút).</summary>
    public static decimal? ResolveSlotPrice(IReadOnlyCollection<CourtPrice> prices, DateTime slotStart)
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

    public static (List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> Items, string? Error)
        NormalizeFromCreateItems(
            IEnumerable<CreateBookingItemDto> items,
            Dictionary<Guid, Court> courtById)
    {
        var normalizedItems = new List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>();
        foreach (var item in items)
        {
            if (item.EndTime <= item.StartTime)
                return (normalizedItems, "Khung giờ không hợp lệ (end phải sau start).");

            if (!courtById.TryGetValue(item.CourtId, out var court))
                return (normalizedItems, "Sân không hợp lệ.");

            for (var slotStart = item.StartTime; slotStart < item.EndTime; slotStart = slotStart.AddMinutes(30))
            {
                var slotEnd = slotStart.AddMinutes(30);
                if (slotEnd > item.EndTime)
                    return (normalizedItems, "Mỗi khung phải là bội số 30 phút.");

                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slotStart);
                if (price == null)
                    return (normalizedItems, $"Chưa cấu hình giá cho sân {court.Name} tại {slotStart:HH:mm}.");

                normalizedItems.Add((item.CourtId, slotStart, slotEnd, price.Value));
            }
        }

        return (normalizedItems, null);
    }

    public static (List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> Items, string? Error)
        ExpandWeeklyLongTerm(
            Guid courtId,
            Court court,
            DateOnly rangeStart,
            DateOnly rangeEnd,
            HashSet<DayOfWeek> dayFilter,
            TimeOnly sessionStart,
            TimeOnly sessionEnd,
            int maxSlots)
    {
        if (rangeEnd < rangeStart)
            return (new List<(Guid, DateTime, DateTime, decimal)>(), "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");

        if (sessionEnd <= sessionStart)
            return (new List<(Guid, DateTime, DateTime, decimal)>(), "Giờ kết thúc phải sau giờ bắt đầu trong ngày.");

        var spanDays = rangeEnd.DayNumber - rangeStart.DayNumber;
        if (spanDays > 186)
            return (new List<(Guid, DateTime, DateTime, decimal)>(), "Khoảng ngày không được vượt quá 6 tháng (~186 ngày).");

        var normalizedItems = new List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>();

        for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
        {
            if (!dayFilter.Contains(d.DayOfWeek))
                continue;

            var dtStart = d.ToDateTime(sessionStart, DateTimeKind.Unspecified);
            var dtEnd = d.ToDateTime(sessionEnd, DateTimeKind.Unspecified);

            for (var slotStart = dtStart; slotStart < dtEnd; slotStart = slotStart.AddMinutes(30))
            {
                var slotEnd = slotStart.AddMinutes(30);
                if (slotEnd > dtEnd)
                    return (normalizedItems, "Khung giờ trong ngày phải là bội số 30 phút.");

                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slotStart);
                if (price == null)
                    return (normalizedItems, $"Chưa cấu hình giá cho sân {court.Name} tại {slotStart:HH:mm}.");

                normalizedItems.Add((courtId, slotStart, slotEnd, price.Value));
                if (normalizedItems.Count > maxSlots)
                    return (normalizedItems, $"Vượt quá số khung tối đa ({maxSlots} ô × 30 phút). Rút ngắn khoảng ngày hoặc giảm số buổi trong tuần.");
            }
        }

        if (normalizedItems.Count == 0)
            return (normalizedItems, "Không có buổi nào khớp điều kiện (thứ trong tuần / khoảng ngày).");

        return (normalizedItems, null);
    }

    /// <summary>Mở rộng lịch tuần với khung giờ riêng biệt cho từng ngày (DailySchedules).</summary>
    public static (List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> Items, string? Error)
        ExpandWeeklyLongTermWithDailySchedules(
            Guid courtId,
            Court court,
            DateOnly rangeStart,
            DateOnly rangeEnd,
            Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)> dayTimeMap,
            int maxSlots)
    {
        if (rangeEnd < rangeStart)
            return (new List<(Guid, DateTime, DateTime, decimal)>(), "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");

        var spanDays = rangeEnd.DayNumber - rangeStart.DayNumber;
        if (spanDays > 186)
            return (new List<(Guid, DateTime, DateTime, decimal)>(), "Khoảng ngày không được vượt quá 6 tháng (~186 ngày).");

        var normalizedItems = new List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)>();

        for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
        {
            if (!dayTimeMap.TryGetValue(d.DayOfWeek, out var times))
                continue;

            if (times.End <= times.Start)
                return (normalizedItems, $"Giờ kết thúc phải sau giờ bắt đầu ({d.DayOfWeek}).");

            var dtStart = d.ToDateTime(times.Start, DateTimeKind.Unspecified);
            var dtEnd = d.ToDateTime(times.End, DateTimeKind.Unspecified);

            for (var slotStart = dtStart; slotStart < dtEnd; slotStart = slotStart.AddMinutes(30))
            {
                var slotEnd = slotStart.AddMinutes(30);
                if (slotEnd > dtEnd)
                    return (normalizedItems, "Khung giờ trong ngày phải là bội số 30 phút.");

                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slotStart);
                if (price == null)
                    return (normalizedItems, $"Chưa cấu hình giá cho sân {court.Name} tại {slotStart:HH:mm}.");

                normalizedItems.Add((courtId, slotStart, slotEnd, price.Value));
                if (normalizedItems.Count > maxSlots)
                    return (normalizedItems, $"Vượt quá số khung tối đa ({maxSlots} ô × 30 phút). Rút ngắn khoảng ngày hoặc giảm số buổi trong tuần.");
            }
        }

        if (normalizedItems.Count == 0)
            return (normalizedItems, "Không có buổi nào khớp điều kiện (thứ trong tuần / khoảng ngày).");

        return (normalizedItems, null);
    }

    public static async Task<string?> CheckSlotConflictsAsync(
        ShuttleUpDbContext db,
        List<Guid> courtIds,
        List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems,
        CancellationToken cancellationToken = default,
        Guid? excludeBookingId = null,
        string? excludeHoldingUserId = null)
    {
        if (normalizedItems.Count == 0)
            return null;

        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);

        var now = DateTime.UtcNow;

        var query = db.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && courtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null
                         && bi.Booking.Status != "CANCELLED");

        // Gỡ bỏ booking hiện tại khỏi việc đụng độ chính nó (khi update-in-place)
        if (excludeBookingId.HasValue)
            query = query.Where(bi => bi.BookingId != excludeBookingId.Value);

        // Bỏ qua các holding đã hết hạn.
        // Ngoài ra, bỏ qua các holding CHƯA hết hạn nhưng LÀ CỦA NGƯỜI CHƠI NÀY (Cho phép họ tạo mới và huỷ cái cũ).
        if (excludeHoldingUserId != null)
        {
            query = query.Where(bi => 
                bi.Booking!.Status != "HOLDING" ||
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now && bi.Booking.UserId != excludeHoldingUserId)
            );
        }
        else
        {
            query = query.Where(bi => 
                bi.Booking!.Status != "HOLDING" ||
                (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now)
            );
        }

        var existingItems = await query.ToListAsync(cancellationToken);

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

        var blocks = await db.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && courtIds.Contains(b.CourtId.Value)
                                            && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync(cancellationToken);

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

    /* ══════════════════════════════════════════════════════════════
     *  SMART ALLOCATION — "Sân bất kỳ" / Auto-switch
     * ══════════════════════════════════════════════════════════════ */

    /// <summary>Kết quả phân bổ thông minh cho 1 slot.</summary>
    public record SmartAllocationItem(
        Guid? CourtId,
        string? CourtName,
        DateTime Start,
        DateTime End,
        decimal Price,
        bool IsUnavailable,
        bool IsSwitched,
        string? SwitchReason
    );

    /// <summary>
    /// Thuật toán 3 pha: Stability → Optimization → Partial.
    /// Bulk-load tất cả conflict data 1 lần, sau đó dò in-memory.
    /// </summary>
    public static async Task<(List<SmartAllocationItem> Items, string? Error)> AllocateFlexibleLongTerm(
        ShuttleUpDbContext db,
        List<Court> allCourts,
        List<(DateTime Start, DateTime End)> requestedSlots,
        Guid? preferredCourtId,
        string pricePreference,
        CancellationToken ct)
    {
        if (requestedSlots.Count == 0)
            return (new List<SmartAllocationItem>(), "Không có buổi nào khớp điều kiện.");

        if (allCourts.Count == 0)
            return (new List<SmartAllocationItem>(), "Cơ sở chưa có sân nào hoạt động.");

        var minStart = requestedSlots.Min(s => s.Start);
        var maxEnd = requestedSlots.Max(s => s.End);
        var allCourtIds = allCourts.Select(c => c.Id).ToList();
        var now = DateTime.UtcNow;

        // ── Bulk load ALL conflicts for the entire venue in the date range ──
        var existingBookings = await db.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && allCourtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null
                         && bi.Booking.Status != "CANCELLED"
                         && (bi.Booking.Status != "HOLDING"
                             || (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now)))
            .ToListAsync(ct);

        var existingBlocks = await db.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && allCourtIds.Contains(b.CourtId.Value)
                        && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync(ct);

        // ── Build busy-set per court ──
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
            if (!busyMap.TryGetValue(courtId, out var set)) return true;
            foreach (var (bs, be) in set)
            {
                if (bs < end && be > start) return false;
            }
            return true;
        }

        // ── Determine price cap for BUDGET mode ──
        decimal? budgetPriceCap = null;
        if (pricePreference == "BUDGET" && preferredCourtId.HasValue)
        {
            var prefCourt = allCourts.FirstOrDefault(c => c.Id == preferredCourtId.Value);
            if (prefCourt != null)
            {
                var maxPrice = prefCourt.CourtPrices.Where(p => p.Price.HasValue).Max(p => p.Price!.Value);
                budgetPriceCap = maxPrice;
            }
        }
        else if (pricePreference == "BUDGET" && !preferredCourtId.HasValue)
        {
            // "Sân bất kỳ" + Budget: use the minimum max-price across all courts
            var minMaxPrice = allCourts
                .Where(c => c.CourtPrices.Any(p => p.Price.HasValue))
                .Select(c => c.CourtPrices.Where(p => p.Price.HasValue).Max(p => p.Price!.Value))
                .DefaultIfEmpty(0)
                .Min();
            budgetPriceCap = minMaxPrice;
        }

        // Filter courts by budget if applicable 
        var candidateCourts = allCourts.ToList();
        if (budgetPriceCap.HasValue && budgetPriceCap > 0)
        {
            candidateCourts = allCourts
                .Where(c => c.CourtPrices.Any(p => p.Price.HasValue && p.Price.Value <= budgetPriceCap.Value))
                .ToList();
            if (candidateCourts.Count == 0)
                candidateCourts = allCourts.ToList(); // fallback to all if budget filter empties
        }

        // ── PHASE 1: Stability — find a single court that fits ALL slots ──
        var orderedCandidates = preferredCourtId.HasValue
            ? candidateCourts.OrderByDescending(c => c.Id == preferredCourtId.Value).ToList()
            : candidateCourts;

        foreach (var court in orderedCandidates)
        {
            var allFree = requestedSlots.All(s => IsSlotFree(court.Id, s.Start, s.End));
            if (allFree)
            {
                // Perfect: single court for everything
                var items = new List<SmartAllocationItem>();
                foreach (var slot in requestedSlots)
                {
                    var price = ResolveSlotPrice(court.CourtPrices.ToList(), slot.Start);
                    if (price == null)
                        return (new List<SmartAllocationItem>(), $"Chưa cấu hình giá cho sân {court.Name} tại {slot.Start:HH:mm}.");
                    items.Add(new SmartAllocationItem(court.Id, court.Name, slot.Start, slot.End, price.Value,
                        IsUnavailable: false, IsSwitched: false, SwitchReason: null));
                }
                return (items, null);
            }
        }

        // ── PHASE 2: Optimization — fill gaps, minimize switching ──
        var primaryCourtId = preferredCourtId ?? orderedCandidates.FirstOrDefault()?.Id;
        var assignCounts = new Dictionary<Guid, int>();
        foreach (var c in candidateCourts) assignCounts[c.Id] = 0;

        var result = new List<SmartAllocationItem>();

        foreach (var slot in requestedSlots)
        {
            SmartAllocationItem? assigned = null;

            // Sort: preferred first → most-assigned (reduce switching) → any
            var sortedCourts = candidateCourts
                .Where(c => IsSlotFree(c.Id, slot.Start, slot.End))
                .OrderByDescending(c => c.Id == primaryCourtId)
                .ThenByDescending(c => assignCounts.GetValueOrDefault(c.Id, 0))
                .ToList();

            foreach (var court in sortedCourts)
            {
                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slot.Start);
                if (price == null) continue;

                bool isSwitched = court.Id != primaryCourtId;
                string? reason = isSwitched
                    ? $"Sân chính đã kín. Hệ thống chuyển sang {court.Name}."
                    : null;

                assigned = new SmartAllocationItem(court.Id, court.Name, slot.Start, slot.End, price.Value,
                    IsUnavailable: false, IsSwitched: isSwitched, SwitchReason: reason);
                assignCounts[court.Id] = assignCounts.GetValueOrDefault(court.Id, 0) + 1;

                // Mark the slot as busy for subsequent checks (prevent double-booking in same preview)
                busyMap[court.Id].Add((slot.Start, slot.End));
                break;
            }

            if (assigned != null)
            {
                result.Add(assigned);
            }
            else
            {
                // ── PHASE 3: Unavailable ──
                // Check if there's a premium court available (for upsell hint)
                string? upsellHint = null;
                if (pricePreference == "BUDGET")
                {
                    var premiumCourt = allCourts
                        .Where(c => !candidateCourts.Contains(c))
                        .FirstOrDefault(c => IsSlotFree(c.Id, slot.Start, slot.End));
                    if (premiumCourt != null)
                    {
                        var premPrice = ResolveSlotPrice(premiumCourt.CourtPrices.ToList(), slot.Start);
                        upsellHint = premPrice.HasValue
                            ? $"Sân tiêu chuẩn đã hết. Sân Premium ({premiumCourt.Name}, {premPrice.Value:N0}đ/30p) còn trống."
                            : null;
                    }
                }
                result.Add(new SmartAllocationItem(null, null, slot.Start, slot.End, 0,
                    IsUnavailable: true, IsSwitched: false, SwitchReason: upsellHint));
            }
        }

        if (result.All(r => r.IsUnavailable))
            return (result, "Tất cả khung giờ đã kín trên mọi sân. Vui lòng đổi thời gian.");

        return (result, null);
    }

    /// <summary>Expand time slots (without court assignment) for use with smart allocation.</summary>
    public static (List<(DateTime Start, DateTime End)> Slots, string? Error) ExpandTimeSlots(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        HashSet<DayOfWeek> dayFilter,
        TimeOnly sessionStart,
        TimeOnly sessionEnd,
        int maxSlots)
    {
        if (rangeEnd < rangeStart)
            return (new(), "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
        if (sessionEnd <= sessionStart)
            return (new(), "Giờ kết thúc phải sau giờ bắt đầu trong ngày.");
        var spanDays = rangeEnd.DayNumber - rangeStart.DayNumber;
        if (spanDays > 90)
            return (new(), "Khoảng ngày không được vượt quá 90 ngày (1 quý).");

        var slots = new List<(DateTime, DateTime)>();
        for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
        {
            if (!dayFilter.Contains(d.DayOfWeek)) continue;
            var dtStart = d.ToDateTime(sessionStart, DateTimeKind.Unspecified);
            var dtEnd = d.ToDateTime(sessionEnd, DateTimeKind.Unspecified);
            for (var ss = dtStart; ss < dtEnd; ss = ss.AddMinutes(30))
            {
                var se = ss.AddMinutes(30);
                if (se > dtEnd) return (slots, "Khung giờ trong ngày phải là bội số 30 phút.");
                slots.Add((ss, se));
                if (slots.Count > maxSlots)
                    return (slots, $"Vượt quá số khung tối đa ({maxSlots} ô × 30 phút).");
            }
        }
        if (slots.Count == 0)
            return (slots, "Không có buổi nào khớp điều kiện (thứ trong tuần / khoảng ngày).");
        return (slots, null);
    }

    /// <summary>Expand time slots with daily schedules for smart allocation.</summary>
    public static (List<(DateTime Start, DateTime End)> Slots, string? Error) ExpandTimeSlotsWithDailySchedules(
        DateOnly rangeStart,
        DateOnly rangeEnd,
        Dictionary<DayOfWeek, (TimeOnly Start, TimeOnly End)> dayTimeMap,
        int maxSlots)
    {
        if (rangeEnd < rangeStart)
            return (new(), "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
        var spanDays = rangeEnd.DayNumber - rangeStart.DayNumber;
        if (spanDays > 90)
            return (new(), "Khoảng ngày không được vượt quá 90 ngày (1 quý).");

        var slots = new List<(DateTime, DateTime)>();
        for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
        {
            if (!dayTimeMap.TryGetValue(d.DayOfWeek, out var times)) continue;
            if (times.End <= times.Start)
                return (slots, $"Giờ kết thúc phải sau giờ bắt đầu ({d.DayOfWeek}).");
            var dtStart = d.ToDateTime(times.Start, DateTimeKind.Unspecified);
            var dtEnd = d.ToDateTime(times.End, DateTimeKind.Unspecified);
            for (var ss = dtStart; ss < dtEnd; ss = ss.AddMinutes(30))
            {
                var se = ss.AddMinutes(30);
                if (se > dtEnd) return (slots, "Khung giờ trong ngày phải là bội số 30 phút.");
                slots.Add((ss, se));
                if (slots.Count > maxSlots)
                    return (slots, $"Vượt quá số khung tối đa ({maxSlots} ô × 30 phút).");
            }
        }
        if (slots.Count == 0)
            return (slots, "Không có buổi nào khớp điều kiện (thứ trong tuần / khoảng ngày).");
        return (slots, null);
    }
}

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
        Guid? excludeBookingId = null)
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
                         && bi.Booking.Status != "CANCELLED"
                         && (bi.Booking.Status != "HOLDING"
                             || (bi.Booking.HoldExpiresAt != null && bi.Booking.HoldExpiresAt > now)));

        // Exclude the booking's own items so it doesn't conflict with itself during update-in-place
        if (excludeBookingId.HasValue)
            query = query.Where(bi => bi.BookingId != excludeBookingId.Value);

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
}

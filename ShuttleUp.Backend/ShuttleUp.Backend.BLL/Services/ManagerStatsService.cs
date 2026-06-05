using ShuttleUp.BLL.Helpers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class ManagerStatsService : IManagerStatsService
{
    private readonly IVenueRepository _venueRepo;
    private readonly IBookingRepository _bookingRepo;
    private readonly ICourtRepository _courtRepo;
    private readonly IRefundRepository _refundRepo;

    private static readonly string[] PaidStatuses = ["CONFIRMED", "COMPLETED"];

    public ManagerStatsService(IVenueRepository venueRepo, IBookingRepository bookingRepo, ICourtRepository courtRepo, IRefundRepository refundRepo)
    {
        _venueRepo = venueRepo; _bookingRepo = bookingRepo; _courtRepo = courtRepo; _refundRepo = refundRepo;
    }

    public async Task<object> GetOverviewAsync(Guid managerId)
    {
        var nowVn = TimeZoneHelper.ToVn(DateTime.UtcNow);
        var startOfDayUtc = TimeZoneHelper.StartOfDayUtc(nowVn);
        var startOfMonthUtc = TimeZoneHelper.StartOfMonthUtc(nowVn);
        var vnTz = TimeZoneHelper.GetVietnamTz();

        var venueIds = await _venueRepo.GetVenueIdsByOwnerAsync(managerId);
        var totalVenues = venueIds.Count;
        var totalCourts = await _courtRepo.CountByVenueIdsAsync(venueIds);
        var activeCourts = await _courtRepo.CountActiveByVenueIdsAsync(venueIds);

        var todayBookings = await _bookingRepo.CountByVenueIdsAsync(venueIds, startOfDayUtc);
        var monthBookings = await _bookingRepo.CountByVenueIdsAsync(venueIds, startOfMonthUtc);
        var pendingCount = await _bookingRepo.CountByStatusInVenuesAsync(venueIds, "PENDING");
        var pendingRefundCount = await _bookingRepo.CountByStatusInVenuesAsync(venueIds, "PENDING_REFUND");
        
        var cancelledCount = await _bookingRepo.CountByVenueIdsFilteredAsync(venueIds, "CANCELLED", startOfMonthUtc, null, null);
        var monthTotalForCancel = await _bookingRepo.CountByVenueIdsFilteredAsync(venueIds, null, startOfMonthUtc, null, null);
        var cancelRate = monthTotalForCancel > 0 ? Math.Round(cancelledCount * 100.0 / monthTotalForCancel, 1) : 0;

        var monthRevenue = await _bookingRepo.SumRevenueByVenueIdsAsync(venueIds, PaidStatuses, startOfMonthUtc);
        var totalRevenue = await _bookingRepo.SumRevenueByVenueIdsAsync(venueIds, PaidStatuses);
        var monthPenalty = await _refundRepo.SumPenaltyByVenueIdsAsync(venueIds, startOfMonthUtc);
        var totalPenalty = await _refundRepo.SumPenaltyByVenueIdsAsync(venueIds);

        var venues = await _venueRepo.GetActiveWithBookingStatsAsync(null, null, startOfMonthUtc, default, default);
        var topVenues = venues.Where(v => venueIds.Contains(v.Id)).Select(v => new
        {
            v.Id, v.Name,
            monthRev = (v.Bookings ?? (ICollection<DAL.Models.Booking>)new List<DAL.Models.Booking>()).Where(b => PaidStatuses.Contains(b.Status) && b.CreatedAt >= startOfMonthUtc).Sum(b => b.FinalAmount ?? 0),
            monthCount = (v.Bookings ?? (ICollection<DAL.Models.Booking>)new List<DAL.Models.Booking>()).Count(b => b.CreatedAt >= startOfMonthUtc)
        }).OrderByDescending(v => v.monthRev).Take(5).ToList();

        var recentRaw = await _bookingRepo.GetRecentByVenuesAsync(venueIds, 5);
        var recentBookings = recentRaw.Select(b => new
        {
            b.Id, player = b.User?.FullName ?? "N/A", venue = b.Venue?.Name ?? "N/A",
            court = string.Join(", ", (b.BookingItems ?? (ICollection<DAL.Models.BookingItem>)new List<DAL.Models.BookingItem>()).Select(bi => bi.Court?.Name ?? "")),
            date = b.CreatedAt.HasValue ? TimeZoneHelper.ToVn(b.CreatedAt.Value).ToString("dd/MM/yyyy") : "",
            startTime = b.BookingItems?.OrderBy(bi => bi.StartTime).Select(bi => bi.StartTime).FirstOrDefault(),
            endTime = b.BookingItems?.OrderByDescending(bi => bi.EndTime).Select(bi => bi.EndTime).FirstOrDefault(),
            amount = b.FinalAmount ?? 0m, b.Status
        }).ToList();

        return new { totalVenues, totalCourts, activeCourts, todayBookings, monthBookings, pendingCount, pendingRefundCount, cancelRate, monthRevenue = monthRevenue + monthPenalty, totalRevenue = totalRevenue + totalPenalty, penaltyRevenue = new { month = monthPenalty, total = totalPenalty }, topVenues, recentBookings };
    }

    public async Task<object> GetEarningsPagedAsync(Guid managerId, Guid? venueId, string? startDate, string? endDate, string? status, string? search, int page, int pageSize)
    {
        if (page <= 0) page = 1; if (pageSize <= 0 || pageSize > 100) pageSize = 20;
        var vnTz = TimeZoneHelper.GetVietnamTz();

        var venueIds = await _venueRepo.GetVenueIdsByOwnerAsync(managerId);
        // Build venue name list for filter dropdown
        var allVenues = (await _venueRepo.GetByOwnerAsync(managerId)).Select(v => new { v.Id, v.Name }).ToList();

        if (venueId.HasValue && !venueIds.Contains(venueId.Value)) throw new UnauthorizedAccessException("Bạn không có quyền truy cập sân này.");
        var targetIds = venueId.HasValue ? new List<Guid> { venueId.Value } : venueIds;

        DateTime? sinceUtc = null, untilUtc = null;
        if (!string.IsNullOrWhiteSpace(startDate) && DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dsLocal))
            sinceUtc = TimeZoneHelper.ToUtc(dsLocal.Date);
        if (!string.IsNullOrWhiteSpace(endDate) && DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var deLocal))
            untilUtc = TimeZoneHelper.ToUtc(deLocal.Date.AddDays(1));

        var totalItems = await _bookingRepo.CountByVenueIdsFilteredAsync(targetIds.ToList(), status, sinceUtc, untilUtc, search);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var totalRevInRange = await _bookingRepo.SumRevenueByVenueIdsFilteredAsync(targetIds.ToList(), PaidStatuses, status, sinceUtc, untilUtc, search);
        var penaltyInRange = await _refundRepo.SumPenaltyByVenueIdsAsync(targetIds.ToList(), sinceUtc, untilUtc);

        // Overall totals (for top stat cards) — only count revenue-generating bookings
        var overallPenaltyCount = await _refundRepo.CountPenaltyBookingsByVenueIdsAsync(targetIds.ToList(), sinceUtc, untilUtc);
        var confirmedCount = await _bookingRepo.CountByVenueIdsFilteredAsync(targetIds.ToList(), "CONFIRMED", sinceUtc, untilUtc, search);
        var completedCount = await _bookingRepo.CountByVenueIdsFilteredAsync(targetIds.ToList(), "COMPLETED", sinceUtc, untilUtc, search);
        var overallTotalItems = confirmedCount + completedCount + overallPenaltyCount;
        var overallTotalRev = await _bookingRepo.SumRevenueByVenueIdsFilteredAsync(targetIds.ToList(), PaidStatuses, null, sinceUtc, untilUtc, search);
        var overallPenalty = await _refundRepo.SumPenaltyByVenueIdsAsync(targetIds.ToList(), sinceUtc, untilUtc);

        var bookings = await _bookingRepo.GetByVenueIdsPagedAsync(targetIds.ToList(), status, sinceUtc, untilUtc, search, (page - 1) * pageSize, pageSize);

        // Batch-fetch refund info cho các booking REFUNDED/PENDING_REFUND trên trang hiện tại
        var refundStatuses = new[] { "REFUNDED", "PENDING_REFUND" };
        var refundBookingIds = bookings.Where(b => refundStatuses.Contains(b.Status)).Select(b => b.Id).ToList();
        var refundMap = refundBookingIds.Any()
            ? await _refundRepo.GetLatestByBookingIdsAsync(refundBookingIds)
            : new Dictionary<Guid, DAL.Models.RefundRequest>();

        var items = bookings.Select(b =>
        {
            refundMap.TryGetValue(b.Id, out var refund);
            var payment = b.Payments?.FirstOrDefault();
            return new
            {
                id = b.Id, refId = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant(),
                player = b.User?.FullName ?? "N/A", 
                playerPhone = b.ContactPhone ?? b.User?.PhoneNumber ?? "—",
                playerImg = b.User?.AvatarFile?.FileUrl,
                venue = b.Venue?.Name ?? "N/A", venueId = b.VenueId,
                court = string.Join(", ", (b.BookingItems ?? (ICollection<DAL.Models.BookingItem>)new List<DAL.Models.BookingItem>()).Select(bi => bi.Court?.Name ?? "")),
                courtImg = b.BookingItems?.OrderBy(bi => bi.StartTime).Select(bi => bi.Court?.Files?.FirstOrDefault()?.FileUrl).FirstOrDefault(url => !string.IsNullOrEmpty(url)),
                date = b.CreatedAt.HasValue ? TimeZoneHelper.ToVn(b.CreatedAt.Value).ToString("dd/MM/yyyy") : "", dateIso = b.CreatedAt,
                startTime = b.BookingItems?.OrderBy(bi => bi.StartTime).Select(bi => bi.StartTime).FirstOrDefault(),
                endTime = b.BookingItems?.OrderByDescending(bi => bi.EndTime).Select(bi => bi.EndTime).FirstOrDefault(),
                amount = b.FinalAmount ?? 0m, status = b.Status, note = b.GuestNote,
                isLongTerm = b.SeriesId.HasValue,
                paymentMethod = payment?.Method,
                paymentStatus = payment?.Status,
                paymentProofImg = payment?.GatewayReference,
                guests = 2,
                // Refund details: refundedAmount = tiền hoàn lại cho khách, paidAmount = tiền khách đã trả, penaltyAmount = tiền manager giữ lại
                refundedAmount = refund?.RequestedAmount ?? 0m,
                paidAmount = refund?.PaidAmount ?? 0m,
                penaltyAmount = refund != null ? (refund.PaidAmount ?? 0m) - (refund.RequestedAmount ?? 0m) : 0m,
                refundStatus = refund?.Status,
                items = (b.BookingItems ?? (ICollection<DAL.Models.BookingItem>)new List<DAL.Models.BookingItem>()).Select(bi => new { 
                    courtName = bi.Court?.Name ?? "Sân", 
                    price = bi.FinalPrice ?? 0,
                    startTime = bi.StartTime,
                    endTime = bi.EndTime
                })
            };
        }).ToList();

        return new { totalItems, totalPages, page, pageSize, totalRevInRange = totalRevInRange + penaltyInRange, penaltyRevenue = penaltyInRange, overallTotalItems, overallTotalRev = overallTotalRev + overallPenalty, overallPenalty, venues = allVenues, items };
    }

    public async Task<object> GetDailyChartAsync(Guid managerId, Guid? venueId, int days)
    {
        if (days <= 0 || days > 365) days = 30;
        var venueIds = await _venueRepo.GetVenueIdsByOwnerAsync(managerId);
        if (venueId.HasValue && !venueIds.Contains(venueId.Value)) throw new UnauthorizedAccessException("Bạn không có quyền truy cập sân này.");
        var targetIds = venueId.HasValue ? new List<Guid> { venueId.Value } : venueIds;

        var nowVn = TimeZoneHelper.ToVn(DateTime.UtcNow);
        var vnSinceDate = nowVn.Date.AddDays(-(days - 1));
        var sinceUtc = TimeZoneHelper.ToUtc(vnSinceDate);

        var raw = await _bookingRepo.GetByVenueIdsWithCreatedAtAsync(targetIds, PaidStatuses, sinceUtc);
        return Enumerable.Range(0, days).Select(i =>
        {
            var vnDay = vnSinceDate.AddDays(i);
            var rev = raw.Where(b => b.CreatedAt.HasValue && TimeZoneHelper.ToVn(b.CreatedAt.Value).Date == vnDay).Sum(b => b.FinalAmount ?? 0);
            return new { date = vnDay.ToString("dd/MM"), dateIso = vnDay.ToString("yyyy-MM-dd"), revenue = rev };
        }).ToList();
    }

    public async Task<object> GetEarningsAnalyticsAsync(Guid managerId)
    {
        var nowVn = TimeZoneHelper.ToVn(DateTime.UtcNow);
        var venueIds = await _venueRepo.GetVenueIdsByOwnerAsync(managerId);
        if (!venueIds.Any()) return new { monthlyRevenue = Array.Empty<object>(), topBookedCourts = Array.Empty<object>(), topCancelledCourts = Array.Empty<object>(), revenueByVenue = Array.Empty<object>() };

        // 1) Monthly revenue (12 months)
        var startOf12MonthsUtc = TimeZoneHelper.ToUtc(new DateTime(nowVn.Year, nowVn.Month, 1).AddMonths(-11));
        var bookings12m = await _bookingRepo.GetByVenueIdsWithCreatedAtAsync(venueIds, PaidStatuses, startOf12MonthsUtc);
        // Get all bookings (not just paid) for counts
        var allBookings12m = await _bookingRepo.GetByVenueIdsWithCreatedAtAsync(venueIds, new[] { "CONFIRMED", "COMPLETED", "PENDING", "CANCELLED" }, startOf12MonthsUtc);

        var monthlyRevenue = Enumerable.Range(0, 12).Select(i =>
        {
            var monthDate = new DateTime(nowVn.Year, nowVn.Month, 1).AddMonths(-11 + i);
            var monthLabel = monthDate.ToString("MM/yyyy");
            bool InMonth(DateTime? ca) => ca.HasValue && TimeZoneHelper.ToVn(ca.Value) is var vn && vn.Year == monthDate.Year && vn.Month == monthDate.Month;
            var revenue = bookings12m.Where(b => InMonth(b.CreatedAt)).Sum(b => b.FinalAmount ?? 0);
            var bookingCount = allBookings12m.Where(b => InMonth(b.CreatedAt) && b.Status != "CANCELLED").Count();
            return new { month = monthLabel, revenue, bookingCount };
        }).ToList();

        // 2) Top 5 courts and cancelled courts (this month)
        var startOfMonthUtc = TimeZoneHelper.StartOfMonthUtc(nowVn);
        var courtBookingItems = await _bookingRepo.GetBookingItemsByVenuesInMonthAsync(venueIds, startOfMonthUtc);

        var topBookedCourts = courtBookingItems
            .Where(bi => bi.Booking?.Status != "CANCELLED")
            .GroupBy(bi => new { bi.CourtId, CourtName = bi.Court?.Name ?? "N/A", VenueName = bi.Court?.Venue?.Name ?? "N/A" })
            .Select(g => new { courtId = g.Key.CourtId, courtName = g.Key.CourtName, venueName = g.Key.VenueName, bookingCount = g.Select(bi => bi.BookingId).Distinct().Count(), revenue = g.Where(bi => PaidStatuses.Contains(bi.Booking?.Status)).Sum(bi => bi.FinalPrice ?? 0) })
            .OrderByDescending(x => x.bookingCount).Take(5).ToList();

        var statusDistribution = courtBookingItems
            .GroupBy(bi => bi.Booking?.Status ?? "UNKNOWN")
            .Select(g => new { status = g.Key, count = g.Select(bi => bi.BookingId).Distinct().Count() })
            .ToList();

        var peakHoursChart = courtBookingItems
            .Where(bi => bi.Booking?.Status != "CANCELLED")
            .GroupBy(bi => bi.StartTime.HasValue ? bi.StartTime.Value.Hour : -1)
            .Where(g => g.Key != -1)
            .Select(g => new { hour = g.Key, count = g.Select(bi => bi.BookingId).Distinct().Count() })
            .OrderBy(x => x.hour)
            .ToList();

        // 4) Revenue by venue
        var venues = await _venueRepo.GetActiveWithBookingStatsAsync(null, null, startOfMonthUtc, default, default);
        var revenueByVenue = venues.Where(v => venueIds.Contains(v.Id)).Select(v => new
        {
            venueId = v.Id, venueName = v.Name ?? "N/A",
            revenue = (v.Bookings ?? (ICollection<DAL.Models.Booking>)new List<DAL.Models.Booking>()).Where(b => PaidStatuses.Contains(b.Status) && b.CreatedAt >= startOfMonthUtc).Sum(b => b.FinalAmount ?? 0),
            bookingCount = (v.Bookings ?? (ICollection<DAL.Models.Booking>)new List<DAL.Models.Booking>()).Count(b => b.Status != "CANCELLED" && b.CreatedAt >= startOfMonthUtc)
        }).OrderByDescending(x => x.revenue).ToList();

        return new { monthlyRevenue, topBookedCourts, statusDistribution, peakHoursChart, revenueByVenue };
    }
}

namespace ShuttleUp.Backend.Helpers;

/// <summary>
/// Helper thuần túy cho xử lý múi giờ Việt Nam (UTC+7).
/// KHÔNG inject Repository hay DbContext.
/// </summary>
public static class TimeZoneHelper
{
    private static TimeZoneInfo? _cached;

    /// <summary>
    /// Lấy TimeZoneInfo cho Việt Nam (UTC+7).
    /// Windows: "SE Asia Standard Time"; Linux: "Asia/Ho_Chi_Minh".
    /// </summary>
    public static TimeZoneInfo GetVietnamTimeZone()
    {
        if (_cached != null) return _cached;

        try { _cached = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
        catch { _cached = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }

        return _cached;
    }

    /// <summary>Chuyển UTC sang giờ Việt Nam.</summary>
    public static DateTime ConvertToVn(DateTime utc)
    {
        var specified = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(specified, GetVietnamTimeZone());
    }

    /// <summary>Chuyển ngày VN (yyyy-MM-dd) sang mốc UTC đầu ngày.</summary>
    public static DateTime? ParseVnDateToUtcStart(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return null;
        if (!DateTime.TryParseExact(dateStr.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var local))
            return null;

        var vnTz = GetVietnamTimeZone();
        var vnStart = DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
    }

    /// <summary>Chuyển ngày VN (yyyy-MM-dd) sang mốc UTC cuối ngày (exclusive, đầu ngày hôm sau).</summary>
    public static DateTime? ParseVnDateToUtcEndExclusive(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return null;
        if (!DateTime.TryParseExact(dateStr.Trim(), "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var local))
            return null;

        var vnTz = GetVietnamTimeZone();
        var vnEndExclusive = DateTime.SpecifyKind(local.Date.AddDays(1), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(vnEndExclusive, vnTz);
    }

    /// <summary>Lấy mốc UTC đầu ngày hôm nay theo VN.</summary>
    public static DateTime GetVnStartOfDayUtc()
    {
        var vnTz = GetVietnamTimeZone();
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz);
        var vnStart = DateTime.SpecifyKind(nowVn.Date, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
    }

    /// <summary>Lấy mốc UTC đầu tháng hiện tại theo VN.</summary>
    public static DateTime GetVnStartOfMonthUtc()
    {
        var vnTz = GetVietnamTimeZone();
        var nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz);
        var vnStart = DateTime.SpecifyKind(new DateTime(nowVn.Year, nowVn.Month, 1), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(vnStart, vnTz);
    }

    /// <summary>Format deadline thời gian Việt Nam.</summary>
    public static string FormatDeadlineVn(DateTime utcDeadline)
    {
        try
        {
            var local = ConvertToVn(utcDeadline);
            return local.ToString("dd/MM/yyyy HH:mm", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"))
                   + " (giờ Việt Nam)";
        }
        catch
        {
            return utcDeadline.ToString("dd/MM/yyyy HH:mm", System.Globalization.CultureInfo.InvariantCulture) + " UTC";
        }
    }
}

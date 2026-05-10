namespace ShuttleUp.BLL.Helpers;

/// <summary>
/// Logic timezone thuần túy — KHÔNG inject bất kỳ dependency nào.
/// </summary>
public static class TimeZoneHelper
{
    private static TimeZoneInfo? _vnTz;

    public static TimeZoneInfo GetVietnamTz()
    {
        if (_vnTz != null) return _vnTz;
        try { _vnTz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
        catch { _vnTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
        return _vnTz;
    }

    public static DateTime ToVn(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), GetVietnamTz());

    public static DateTime ToUtc(DateTime vnLocal)
        => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(vnLocal, DateTimeKind.Unspecified), GetVietnamTz());

    public static DateTime StartOfDayUtc(DateTime vnNow)
        => ToUtc(vnNow.Date);

    public static DateTime StartOfMonthUtc(DateTime vnNow)
        => ToUtc(new DateTime(vnNow.Year, vnNow.Month, 1));
}

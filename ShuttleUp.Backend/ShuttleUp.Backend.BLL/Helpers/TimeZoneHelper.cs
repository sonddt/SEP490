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

    /// <summary>Thời điểm hiện tại theo giờ Việt Nam (wall-clock).</summary>
    public static DateTime NowVn() => ToVn(DateTime.UtcNow);

    /// <summary>
    /// Khung đã qua: EndTime (lưu wall-clock VN, Kind Unspecified) không còn sau thời điểm hiện tại VN.
    /// Cùng quy ước với lưới đặt lẻ (slot kết thúc &lt;= bây giờ → không chọn được).
    /// </summary>
    public static bool IsSlotInPast(DateTime slotEndVnLocal)
        => slotEndVnLocal <= NowVn();

    /// <summary>Format deadline UTC sang chuỗi hiển thị giờ Việt Nam.</summary>
    public static string FormatDeadlineVn(DateTime utcDeadline)
    {
        try
        {
            var local = ToVn(utcDeadline);
            return local.ToString("dd/MM/yyyy HH:mm", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"))
                   + " (giờ Việt Nam)";
        }
        catch
        {
            return utcDeadline.ToString("dd/MM/yyyy HH:mm", System.Globalization.CultureInfo.InvariantCulture) + " UTC";
        }
    }
}

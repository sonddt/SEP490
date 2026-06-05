using System.Text.Json;
using System.Text.RegularExpressions;

namespace ShuttleUp.Backend.Helpers;

/// <summary>
/// Helper thuần túy cho xử lý chuỗi (sanitize, normalize).
/// KHÔNG inject Repository hay DbContext.
/// </summary>
public static class TextSanitizer
{
    /// <summary>Xóa HTML tags, giới hạn chiều dài.</summary>
    public static string? SanitizeText(string? input, int maxLen = 1000)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var clean = Regex.Replace(input.Trim(), @"<[^>]*>", "");
        return clean.Length > maxLen ? clean[..maxLen] : clean;
    }

    /// <summary>Sanitize ghi chú cho court block.</summary>
    public static string? SanitizeBlockNote(string? input, int maxLen = 500)
        => SanitizeText(input, maxLen);

    /// <summary>Chuẩn hóa reason code cho court block.</summary>
    public static string NormalizeBlockReasonCode(string? code)
    {
        var c = (code ?? "OTHER").Trim().ToUpperInvariant();
        return c is "MAINTENANCE" or "WEATHER" or "OTHER" ? c : "OTHER";
    }

    /// <summary>Parse JSON array string thành List&lt;string&gt;.</summary>
    public static List<string>? ParseJsonArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<List<string>>(json); }
        catch { return null; }
    }
}

using System.Text.RegularExpressions;

namespace ShuttleUp.BLL.Helpers;

/// <summary>
/// Logic xử lý chuỗi thuần túy — KHÔNG inject bất kỳ dependency nào.
/// </summary>
public static class TextHelper
{
    public static string? SanitizeText(string? input, int maxLen = 1000)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var clean = Regex.Replace(input.Trim(), @"<[^>]*>", "");
        return clean.Length > maxLen ? clean[..maxLen] : clean;
    }

    public static string NormalizeBlockReasonCode(string? code)
    {
        var c = (code ?? "OTHER").Trim().ToUpperInvariant();
        return c is "MAINTENANCE" or "WEATHER" or "OTHER" ? c : "OTHER";
    }

    public static Dictionary<string, string> BlockReasonLabels { get; } = new()
    {
        ["MAINTENANCE"] = "Bảo trì",
        ["WEATHER"] = "Thời tiết / môi trường",
        ["OTHER"] = "Khác"
    };
}

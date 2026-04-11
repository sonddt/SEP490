using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ShuttleUp.Backend.Utils;

/// <summary>Đồng bộ logic với ShuttleUp.Frontend/src/utils/searchNormalize.js (bỏ dấu, gộp space, thường).</summary>
public static class SearchNormalize
{
    private static readonly Regex Whitespace = new(@"\s+", RegexOptions.Compiled);

    public static string Fold(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var trimmed = s.Trim();
        if (trimmed.Length == 0) return "";
        var formD = trimmed.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(formD.Length);
        foreach (var ch in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        var collapsed = Whitespace.Replace(sb.ToString().Normalize(NormalizationForm.FormC), " ");
        return collapsed.Trim().ToLowerInvariant();
    }

    public static bool FoldedContains(string? haystack, string foldedQuery)
    {
        if (string.IsNullOrEmpty(foldedQuery)) return true;
        return Fold(haystack).Contains(foldedQuery, StringComparison.Ordinal);
    }
}

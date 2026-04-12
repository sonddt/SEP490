using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ShuttleUp.Backend.Utils;

/// <summary>Đồng bộ logic với ShuttleUp.Frontend/src/utils/searchNormalize.js (bỏ dấu, gộp space, thường).</summary>
public static class SearchNormalize
{
    private static readonly Regex AdminPrefixes = new(@"\b(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|tp|tx|q|p|h)\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex Punctuation = new(@"[.,\-]", RegexOptions.Compiled);
    private static readonly Regex Whitespace = new(@"\s+", RegexOptions.Compiled);
    private static readonly Dictionary<string, string> CityAliases = new()
    {
        { "ho chi minh", "hcm" },
        { "ha noi", "hn" },
        { "da nang", "dn" },
        { "hai phong", "hp" },
        { "can tho", "ct" },
        { "ba ria vung tau", "brvt" },
        { "vung tau", "vt" },
        { "buon ma thuot", "bmt" },
        { "nha trang", "nt" },
        { "phan thiet", "pt" },
        { "quy nhon", "qn" },
        { "da lat", "dl" }
    };

    public static string Fold(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        
        // 1. Lowercase and Remove Accents (NFD -> loop -> NFC)
        var normalized = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var str = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();

        // 2. Replace punctuation with space
        str = Punctuation.Replace(str, " ");

        // 3. Strip administrative prefixes
        str = AdminPrefixes.Replace(str, " ");

        // 4. Apply City Aliases
        foreach (var kvp in CityAliases)
        {
            // \b replacement in C#
            str = Regex.Replace(str, $@"\b{kvp.Key}\b", kvp.Value, RegexOptions.IgnoreCase);
        }

        // 5. Collapse whitespace and trim
        return Whitespace.Replace(str, " ").Trim();
    }

    public static bool FoldedContains(string? haystack, string foldedQuery)
    {
        if (string.IsNullOrEmpty(foldedQuery)) return true;
        return Fold(haystack).Contains(foldedQuery, StringComparison.Ordinal);
    }
}

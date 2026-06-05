using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ShuttleUp.DAL.Helpers;

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
        var normalized = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var str = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        str = Punctuation.Replace(str, " ");
        str = AdminPrefixes.Replace(str, " ");
        foreach (var kvp in CityAliases)
        {
            str = Regex.Replace(str, $@"\b{kvp.Key}\b", kvp.Value, RegexOptions.IgnoreCase);
        }
        return Whitespace.Replace(str, " ").Trim();
    }

    public static bool FoldedContains(string? haystack, string rawQuery)
    {
        var foldedQuery = Fold(rawQuery);
        if (string.IsNullOrEmpty(foldedQuery)) return true;
        var target = Fold(haystack);
        var tokens = foldedQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tokens.All(t => target.Contains(t, StringComparison.Ordinal));
    }
}

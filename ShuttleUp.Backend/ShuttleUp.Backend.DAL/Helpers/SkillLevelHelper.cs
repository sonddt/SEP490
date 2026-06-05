namespace ShuttleUp.DAL.Helpers;

/// <summary>
/// Chuẩn hóa trình độ: giá trị canonical tiếng Việt + alias legacy tiếng Anh trong DB cũ.
/// </summary>
public static class SkillLevelHelper
{
    private static readonly Dictionary<string, string> LegacyToCanonical = new(StringComparer.OrdinalIgnoreCase)
    {
        ["beginner"] = "Yếu",
        ["intermediate"] = "Trung Bình",
        ["advanced"] = "Khá",
        ["expert"] = "Chuyên Nghiệp",
    };

    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return LegacyToCanonical.TryGetValue(trimmed, out var canonical) ? canonical : trimmed;
    }

    public static IReadOnlyList<string> GetFilterAliases(string? filterValue)
    {
        if (string.IsNullOrWhiteSpace(filterValue)) return Array.Empty<string>();

        var canonical = Normalize(filterValue) ?? filterValue.Trim();
        var aliases = new List<string> { canonical };

        foreach (var kvp in LegacyToCanonical)
        {
            if (string.Equals(kvp.Value, canonical, StringComparison.OrdinalIgnoreCase)
                && !aliases.Contains(kvp.Key, StringComparer.OrdinalIgnoreCase))
            {
                aliases.Add(kvp.Key);
            }
        }

        if (!aliases.Contains(filterValue.Trim(), StringComparer.OrdinalIgnoreCase))
            aliases.Add(filterValue.Trim());

        return aliases;
    }
}

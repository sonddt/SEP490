using System.Collections.Frozen;

namespace ShuttleUp.Backend;

/// <summary>
/// VietQR image URL (img.vietqr.io) — không cần API key.
/// </summary>
public static class VietQrHelper
{
    private static readonly FrozenDictionary<string, string> BankNameToBin = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["Vietcombank"] = "970436",
        ["BIDV"] = "970418",
        ["VietinBank"] = "970415",
        ["Techcombank"] = "970407",
        ["MB Bank"] = "970422",
        ["ACB"] = "970416",
        ["Sacombank"] = "970403",
        ["VP Bank"] = "970432",
        ["TPBank"] = "970423",
        ["HD Bank"] = "970437",
        ["SHB"] = "970443",
        ["OCB"] = "970448",
        ["SeABank"] = "970440",
        ["LPBank"] = "970449",
        ["Eximbank"] = "970431",
    }.ToFrozenDictionary(StringComparer.OrdinalIgnoreCase);

    public static string? ResolveBin(string? paymentBankBin, string? paymentBankName)
    {
        if (!string.IsNullOrWhiteSpace(paymentBankBin))
        {
            var b = paymentBankBin.Trim();
            if (b.Length >= 6 && b.All(char.IsDigit))
                return b;
        }

        if (string.IsNullOrWhiteSpace(paymentBankName))
            return null;

        return BankNameToBin.TryGetValue(paymentBankName.Trim(), out var bin) ? bin : null;
    }

    /// <summary>
    /// URL ảnh QR (compact2). amount VND (integer). addInfo không dấu tốt nhất cho QR.
    /// </summary>
    public static string? BuildQrImageUrl(string? bin, string? accountNumber, decimal amountVnd, string? addInfo)
    {
        if (string.IsNullOrWhiteSpace(bin) || string.IsNullOrWhiteSpace(accountNumber))
            return null;

        var acc = accountNumber.Replace(" ", "").Trim();
        if (acc.Length < 6)
            return null;

        var amt = (long)Math.Round(amountVnd, MidpointRounding.AwayFromZero);
        if (amt < 0) amt = 0;

        var url = $"https://img.vietqr.io/image/{bin}-{acc}-compact2.jpg?amount={amt}";
        if (!string.IsNullOrWhiteSpace(addInfo))
            url += "&addInfo=" + Uri.EscapeDataString(addInfo.Trim());
        return url;
    }
}

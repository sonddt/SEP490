using Microsoft.AspNetCore.Http;

namespace ShuttleUp.Backend.Vnpay;

internal static class VnpayQueryBuilder
{
    /// <summary>
    /// Ký query VNPay (HMAC-SHA512) theo thứ tự key alphabet, bỏ qua vnp_SecureHash / vnp_SecureHashType.
    /// </summary>
    public static string BuildSignedQuery(
        SortedDictionary<string, string> vnpParams,
        string hashSecret,
        out string signData)
    {
        signData = string.Join("&", vnpParams
            .Where(kv => !string.IsNullOrEmpty(kv.Value) && kv.Key != "vnp_SecureHash" && kv.Key != "vnp_SecureHashType")
            .Select(kv => $"{kv.Key}={kv.Value}"));
        return VnpayCrypto.HmacSha512Hex(hashSecret, signData);
    }

    public static SortedDictionary<string, string> ParseQuery(IQueryCollection query)
    {
        var d = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var kv in query)
        {
            if (kv.Key.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase))
                d[kv.Key] = kv.Value.ToString();
        }
        return d;
    }

    public static string BuildPaymentUrl(string paymentUrl, SortedDictionary<string, string> vnpParams, string hashSecret)
    {
        var sign = BuildSignedQuery(vnpParams, hashSecret, out _);
        vnpParams["vnp_SecureHash"] = sign;
        var qs = string.Join("&", vnpParams.Select(kv =>
            $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
        var baseUrl = paymentUrl.TrimEnd('?', '&');
        return qs.Length > 0 ? $"{baseUrl}?{qs}" : baseUrl;
    }
}

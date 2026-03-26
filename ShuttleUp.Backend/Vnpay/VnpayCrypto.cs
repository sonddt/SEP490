using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace ShuttleUp.Backend.Vnpay;

internal static class VnpayCrypto
{
    public static string HmacSha512Hex(string secret, string data)
    {
        using var h = new HMACSHA512(Encoding.UTF8.GetBytes(secret));
        var hash = h.ComputeHash(Encoding.UTF8.GetBytes(data));
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
            sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        return sb.ToString();
    }
}

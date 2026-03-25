using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend;

internal static class BookingApprovalRules
{
    /// <summary>
    /// Có ít nhất một bản ghi thanh toán với chứng từ (URL https) — bắt buộc trước khi duyệt CONFIRMED.
    /// </summary>
    public static bool HasHttpsPaymentProof(IEnumerable<Payment> payments) =>
        payments.Any(p =>
            !string.IsNullOrWhiteSpace(p.GatewayReference)
            && p.GatewayReference.TrimStart().StartsWith("https://", StringComparison.OrdinalIgnoreCase));
}

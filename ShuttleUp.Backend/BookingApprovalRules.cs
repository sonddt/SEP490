using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend;

internal static class BookingApprovalRules
{
    /// <summary>
    /// Có chứng từ hợp lệ để duyệt: ảnh CK (URL https) hoặc VNPay đã hoàn tất (COMPLETED).
    /// </summary>
    public static bool HasHttpsPaymentProof(IEnumerable<Payment> payments) =>
        payments.Any(p =>
            (!string.IsNullOrWhiteSpace(p.GatewayReference)
             && p.GatewayReference.TrimStart().StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            || (p.Method != null && p.Method.Equals("VNPAY", StringComparison.OrdinalIgnoreCase)
                && p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase)));
}

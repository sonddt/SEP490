using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Vnpay;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Return URL & IPN VNPay (không cần Bearer; xác thực bằng chữ ký).
/// </summary>
[ApiController]
[Route("api/payments/vnpay")]
[AllowAnonymous]
public class VnpayPaymentsController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly IOptions<VnpayOptions> _vnpay;
    private readonly IConfiguration _configuration;

    public VnpayPaymentsController(
        ShuttleUpDbContext db,
        IOptions<VnpayOptions> vnpay,
        IConfiguration configuration)
    {
        _db = db;
        _vnpay = vnpay;
        _configuration = configuration;
    }

    [HttpGet("return")]
    public async Task<IActionResult> Return()
    {
        var opt = _vnpay.Value;
        if (!opt.Enabled || string.IsNullOrWhiteSpace(opt.HashSecret))
            return RedirectToFrontend("vnpay=0&reason=config");

        var dict = VnpayQueryBuilder.ParseQuery(Request.Query);
        if (!dict.TryGetValue("vnp_SecureHash", out var secureHash))
            return RedirectToFrontend("vnpay=0&reason=hash");

        var sign = VnpayQueryBuilder.BuildSignedQuery(dict, opt.HashSecret, out _);
        if (!string.Equals(sign, secureHash, StringComparison.OrdinalIgnoreCase))
            return RedirectToFrontend("vnpay=0&reason=invalid_sign");

        var bookingId = await TryCompletePaymentAsync(dict, opt);

        dict.TryGetValue("vnp_ResponseCode", out var code);
        code ??= "";
        dict.TryGetValue("vnp_TxnRef", out var txnRef);
        txnRef ??= "";
        var bid = bookingId.HasValue ? $"&bookingId={Uri.EscapeDataString(bookingId.Value.ToString())}" : "";
        if (code == "00")
            return RedirectToFrontend($"vnpay=1&txnRef={Uri.EscapeDataString(txnRef)}{bid}");
        return RedirectToFrontend($"vnpay=0&code={Uri.EscapeDataString(code)}&txnRef={Uri.EscapeDataString(txnRef)}{bid}");
    }

    [HttpGet("ipn")]
    public async Task<IActionResult> Ipn()
    {
        var opt = _vnpay.Value;
        if (!opt.Enabled || string.IsNullOrWhiteSpace(opt.HashSecret))
            return Content("{\"RspCode\":\"99\",\"Message\":\"Fail\"}", "application/json");

        var dict = VnpayQueryBuilder.ParseQuery(Request.Query);
        if (!dict.TryGetValue("vnp_SecureHash", out var secureHash))
            return Content("{\"RspCode\":\"97\",\"Message\":\"Fail\"}", "application/json");

        var sign = VnpayQueryBuilder.BuildSignedQuery(dict, opt.HashSecret, out _);
        if (!string.Equals(sign, secureHash, StringComparison.OrdinalIgnoreCase))
            return Content("{\"RspCode\":\"97\",\"Message\":\"Invalid signature\"}", "application/json");

        var bookingId = await TryCompletePaymentAsync(dict, opt);
        if (bookingId != null)
            return Content("{\"RspCode\":\"00\",\"Message\":\"Confirm Success\"}", "application/json");
        return Content("{\"RspCode\":\"99\",\"Message\":\"Fail\"}", "application/json");
    }

    private IActionResult RedirectToFrontend(string query)
    {
        var fe = _configuration["App:FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
        return Redirect($"{fe}/booking/payment?{query}");
    }

    /// <returns>BookingId khi xử lý xong (kể cả đã COMPLETED từ trước); null nếu lỗi.</returns>
    private async Task<Guid?> TryCompletePaymentAsync(SortedDictionary<string, string> dict, VnpayOptions opt)
    {
        dict.TryGetValue("vnp_TxnRef", out var txnRef);
        dict.TryGetValue("vnp_ResponseCode", out var responseCode);
        dict.TryGetValue("vnp_TransactionNo", out var transactionNo);
        transactionNo ??= "";
        dict.TryGetValue("vnp_Amount", out var amountStr);

        if (string.IsNullOrEmpty(txnRef) || !Guid.TryParseExact(txnRef, "N", out var paymentId))
            return null;

        var payment = await _db.Payments
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.Id == paymentId);

        if (payment?.Booking == null || payment.Method != "VNPAY")
            return null;

        if (payment.Status != null && payment.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
            return payment.BookingId;

        if (responseCode != "00")
        {
            payment.Status = "FAILED";
            payment.GatewayReference = $"vnpay:failed:{transactionNo}";
            await _db.SaveChangesAsync();
            return null;
        }

        if (!string.IsNullOrEmpty(amountStr) && long.TryParse(amountStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var vnpAmount))
        {
            var expected = (long)((payment.Booking.FinalAmount ?? 0m) * 100m);
            if (expected > 0 && vnpAmount != expected)
            {
                payment.Status = "FAILED";
                payment.GatewayReference = $"vnpay:amount_mismatch:{transactionNo}";
                await _db.SaveChangesAsync();
                return null;
            }
        }

        payment.Status = "COMPLETED";
        payment.GatewayReference = $"https://vnpayment.vn/?txn={Uri.EscapeDataString(transactionNo)}";
        payment.ConfirmedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return payment.BookingId;
    }
}

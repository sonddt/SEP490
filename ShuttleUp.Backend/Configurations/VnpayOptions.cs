namespace ShuttleUp.Backend.Configurations;

public class VnpayOptions
{
    public bool Enabled { get; set; }

    public string TmnCode { get; set; } = string.Empty;

    public string HashSecret { get; set; } = string.Empty;

    public string PaymentUrl { get; set; } = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
}

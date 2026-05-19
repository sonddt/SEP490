namespace ShuttleUp.BLL.DTOs.Booking;

public class CancelBookingBodyDto
{
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountHolder { get; set; }
    public string? RefundQrImageUrl { get; set; }
    public string? PlayerNote { get; set; }
}

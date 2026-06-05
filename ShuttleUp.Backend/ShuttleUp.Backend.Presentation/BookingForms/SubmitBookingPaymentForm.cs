using Microsoft.AspNetCore.Http;

namespace ShuttleUp.Backend.BookingForms;

/// <summary>
/// Form multipart cho POST /api/bookings/{id}/payment — một class [FromForm] để Swashbuckle tạo OpenAPI đúng.
/// </summary>
public class SubmitBookingPaymentForm
{
    public string Method { get; set; } = string.Empty;

    public IFormFile ProofImage { get; set; } = null!;
}

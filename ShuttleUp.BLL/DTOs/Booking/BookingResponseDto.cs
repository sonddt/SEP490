namespace ShuttleUp.BLL.DTOs.Booking;

public class BookingItemResponseDto
{
    public Guid Id { get; set; }

    public Guid CourtId { get; set; }

    public string? CourtName { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public decimal FinalPrice { get; set; }

    public string? Status { get; set; }
}

public class BookingResponseDto
{
    public Guid BookingId { get; set; }

    public string BookingCode { get; set; } = string.Empty;

    public string? Status { get; set; }

    public decimal TotalAmount { get; set; }

    public decimal FinalAmount { get; set; }

    public List<BookingItemResponseDto> Items { get; set; } = new();
}

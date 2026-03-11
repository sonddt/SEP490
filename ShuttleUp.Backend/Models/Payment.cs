using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class Payment
{
    public Guid Id { get; set; }

    public Guid? BookingId { get; set; }

    public string? Method { get; set; }

    public string? Status { get; set; }

    public decimal? Amount { get; set; }

    public string? GatewayReference { get; set; }

    public Guid? ConfirmedBy { get; set; }

    public DateTime? ConfirmedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual User? ConfirmedByNavigation { get; set; }

    public virtual ICollection<RefundTransaction> RefundTransactions { get; set; } = new List<RefundTransaction>();
}

using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class RefundTransaction
{
    public Guid Id { get; set; }

    public Guid? RefundRequestId { get; set; }

    public Guid? PaymentId { get; set; }

    public decimal? Amount { get; set; }

    public string? Method { get; set; }

    public string? Status { get; set; }

    public string? GatewayReference { get; set; }

    public Guid? ProcessedBy { get; set; }

    public DateTime? ProcessedAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual Payment? Payment { get; set; }

    public virtual User? ProcessedByNavigation { get; set; }

    public virtual RefundRequest? RefundRequest { get; set; }
}

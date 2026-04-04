using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class RefundRequest
{
    public Guid Id { get; set; }

    public Guid? BookingId { get; set; }

    public Guid? UserId { get; set; }

    public string ReasonCode { get; set; } = "PLAYER_CANCEL";

    public string? Status { get; set; }

    public decimal? RequestedAmount { get; set; }

    public decimal? PaidAmount { get; set; }

    public string? RefundBankName { get; set; }

    public string? RefundAccountNumber { get; set; }

    public string? RefundAccountHolder { get; set; }

    public string? PlayerNote { get; set; }

    public string? RejectionReason { get; set; }

    public string? ManagerNote { get; set; }

    public Guid? ManagerEvidenceFileId { get; set; }

    public Guid? PlayerReceivedFileId { get; set; }

    public DateTime? RequestedAt { get; set; }

    public Guid? ProcessedBy { get; set; }

    public DateTime? ProcessedAt { get; set; }

    public virtual Booking? Booking { get; set; }

    public virtual User? ProcessedByNavigation { get; set; }

    public virtual ICollection<RefundTransaction> RefundTransactions { get; set; } = new List<RefundTransaction>();

    public virtual User? User { get; set; }

    public virtual File? ManagerEvidenceFile { get; set; }

    public virtual File? PlayerReceivedFile { get; set; }

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

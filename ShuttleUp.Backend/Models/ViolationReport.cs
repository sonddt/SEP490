using System;
using System.Collections.Generic;

namespace ShuttleUp.Backend.Models;

public partial class ViolationReport
{
    public Guid Id { get; set; }

    public Guid? ReporterUserId { get; set; }

    /// <summary>USER | VENUE | MATCHING_POST | BOOKING</summary>
    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    public string? Reason { get; set; }

    public string? Description { get; set; }

    /// <summary>PENDING | REVIEWING | REFUND_PENDING | RESOLVED | REJECTED</summary>
    public string? Status { get; set; }

    public Guid? AdminUserId { get; set; }

    public string? AdminNote { get; set; }

    /// <summary>WARN_USER | LOCK_USER | WARN_VENUE | LOCK_VENUE | REMOVE_POST | REFUND | NO_ACTION</summary>
    public string? AdminAction { get; set; }

    public DateTime? DecisionAt { get; set; }

    /// <summary>Hạn xử lý hoàn tiền (khi Status = REFUND_PENDING).</summary>
    public DateTime? RefundDeadlineAt { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual User? AdminUser { get; set; }

    public virtual User? ReporterUser { get; set; }

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

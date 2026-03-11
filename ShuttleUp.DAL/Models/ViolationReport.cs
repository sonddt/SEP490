using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ViolationReport
{
    public Guid Id { get; set; }

    public Guid? ReporterUserId { get; set; }

    public string? TargetType { get; set; }

    public Guid? TargetId { get; set; }

    public string? Reason { get; set; }

    public string? Description { get; set; }

    public string? Status { get; set; }

    public Guid? AdminUserId { get; set; }

    public DateTime? DecisionAt { get; set; }

    public virtual User? AdminUser { get; set; }

    public virtual User? ReporterUser { get; set; }

    public virtual ICollection<File> Files { get; set; } = new List<File>();
}

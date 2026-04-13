using System;

namespace ShuttleUp.DAL.Models;

public partial class ViolationReportLog
{
    public Guid Id { get; set; }

    public Guid ReportId { get; set; }

    public Guid AdminUserId { get; set; }

    public string Status { get; set; } = null!;

    public string? AdminAction { get; set; }

    public string? AdminNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User AdminUser { get; set; } = null!;

    public virtual ViolationReport Report { get; set; } = null!;
}

using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class CourtBlock
{
    public Guid Id { get; set; }

    public Guid? CourtId { get; set; }

    public DateTime? StartTime { get; set; }

    public DateTime? EndTime { get; set; }

    public Guid? CreatedBy { get; set; }

    /// <summary>MAINTENANCE | WEATHER | OTHER</summary>
    public string? ReasonCode { get; set; }

    /// <summary>Hiển thị cho người chơi (plain text).</summary>
    public string? ReasonDetail { get; set; }

    /// <summary>Ghi chú nội bộ chủ sân.</summary>
    public string? InternalNote { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Court? Court { get; set; }

    public virtual User? CreatedByNavigation { get; set; }
}

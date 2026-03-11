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

    public virtual Court? Court { get; set; }

    public virtual User? CreatedByNavigation { get; set; }
}

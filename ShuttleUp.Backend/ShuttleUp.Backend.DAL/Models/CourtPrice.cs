using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class CourtPrice
{
    public Guid Id { get; set; }

    public Guid? CourtId { get; set; }

    public TimeOnly? StartTime { get; set; }

    public TimeOnly? EndTime { get; set; }

    public decimal? Price { get; set; }

    public bool? IsWeekend { get; set; }

    public virtual Court? Court { get; set; }
}

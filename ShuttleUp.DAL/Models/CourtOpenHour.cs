using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class CourtOpenHour
{
    public Guid Id { get; set; }

    public Guid? CourtId { get; set; }

    public int? DayOfWeek { get; set; }

    public TimeOnly? OpenTime { get; set; }

    public TimeOnly? CloseTime { get; set; }

    public virtual Court? Court { get; set; }
}


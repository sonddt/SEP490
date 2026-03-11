using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class VenueOpenHour
{
    public Guid Id { get; set; }

    public Guid? VenueId { get; set; }

    public int? DayOfWeek { get; set; }

    public TimeOnly? OpenTime { get; set; }

    public TimeOnly? CloseTime { get; set; }

    public virtual Venue? Venue { get; set; }
}

using ShuttleUp.DAL.Models;
using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Booking;

public class FlexibleLongTermBuildResultDto
{
    public List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> NormalizedItems { get; set; } = new();
    public Dictionary<Guid, Court> CourtById { get; set; } = new();
    public DateOnly RangeStart { get; set; }
    public DateOnly RangeEnd { get; set; }
}

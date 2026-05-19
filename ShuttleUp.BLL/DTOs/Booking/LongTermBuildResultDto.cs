using ShuttleUp.DAL.Models;
using ShuttleUp.BLL.Helpers;
using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Booking;

public class LongTermBuildResultDto
{
    public List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> NormalizedItems { get; set; } = new();
    public List<BookingSlotHelper.SmartAllocationItem>? SmartItems { get; set; }
    public Court? Court { get; set; }
    public DateOnly RangeStart { get; set; }
    public DateOnly RangeEnd { get; set; }
    public TimeOnly SessionStart { get; set; }
    public TimeOnly SessionEnd { get; set; }
}

using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class BookingSeries
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid VenueId { get; set; }

    /// <summary>
    /// JSON quy tắc: WEEKLY (lặp tuần) hoặc FLEXIBLE (nhiều slot tự chọn).
    /// WEEKLY: type, daysOfWeek, sessionStart, sessionEnd, courtId.
    /// FLEXIBLE: type, itemCount (tổng số ô 30 phút).
    /// </summary>
    public string RecurrenceRuleJson { get; set; } = "{}";

    public DateOnly RangeStartDate { get; set; }

    public DateOnly RangeEndDate { get; set; }

    public string Status { get; set; } = "PENDING";

    public DateTime CreatedAt { get; set; }

    public virtual User? User { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}

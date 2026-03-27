namespace ShuttleUp.Backend.Helpers;

/// <summary>Metadata JSON cho deep link + filter.</summary>
public static class NotificationMetadataBuilder
{
    public static object BookingForManager(Guid bookingId, Guid? venueId)
    {
        return new
        {
            entityType = "booking",
            bookingId,
            venueId,
            deepLink = $"/manager/bookings?bookingId={bookingId}",
        };
    }

    public static object BookingForPlayer(Guid bookingId)
    {
        return new
        {
            entityType = "booking",
            bookingId,
            deepLink = $"/user/bookings?bookingId={bookingId}",
        };
    }
}

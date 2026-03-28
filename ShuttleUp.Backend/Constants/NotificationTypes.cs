namespace ShuttleUp.Backend.Constants;

/// <summary>Giá trị cột type trong user_notifications — dùng chung backend/frontend.</summary>
public static class NotificationTypes
{
    public const string BookingNew = "BOOKING_NEW";
    public const string Booking = "BOOKING";
    public const string PaymentProof = "PAYMENT_PROOF";
    public const string System = "SYSTEM";

    public const string FriendRequest = "FRIEND_REQUEST";

    public const string FriendAccepted = "FRIEND_ACCEPTED";
}

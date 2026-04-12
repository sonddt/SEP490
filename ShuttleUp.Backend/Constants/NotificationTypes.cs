namespace ShuttleUp.Backend.Constants;

/// <summary>Giá trị cột type trong user_notifications — dùng chung backend/frontend.</summary>
public static class NotificationTypes
{
    public const string BookingNew = "BOOKING_NEW";
    public const string Booking = "BOOKING";

    /// <summary>Khóa khung giờ sân (bảo trì, thời tiết…).</summary>
    public const string CourtBlock = "COURT_BLOCK";
    public const string PaymentProof = "PAYMENT_PROOF";
    public const string System = "SYSTEM";

    public const string FriendRequest = "FRIEND_REQUEST";

    public const string FriendAccepted = "FRIEND_ACCEPTED";

    // ── Matching ──────────────────────────────────────────────────────
    public const string MatchingJoinRequest = "MATCHING_JOIN_REQUEST";
    public const string MatchingJoinAccepted = "MATCHING_JOIN_ACCEPTED";
    public const string MatchingJoinRejected = "MATCHING_JOIN_REJECTED";
    public const string MatchingMemberKicked = "MATCHING_MEMBER_KICKED";
    public const string MatchingPostClosed = "MATCHING_POST_CLOSED";
    public const string MatchingPostCancelled = "MATCHING_POST_CANCELLED";
    public const string MatchingNewComment = "MATCHING_NEW_COMMENT";
    public const string MatchingCommentReply = "MATCHING_COMMENT_REPLY";

    // ── Refund ───────────────────────────────────────────────────────
    public const string RefundRequest = "REFUND_REQUEST";
    public const string RefundCompleted = "REFUND_COMPLETED";
    public const string RefundRejected = "REFUND_REJECTED";
    public const string RefundReconciled = "REFUND_RECONCILED";

    // ── Venue reviews ───────────────────────────────────────────────
    /// <summary>Người chơi vừa đánh giá sân — gửi cho chủ sân.</summary>
    public const string VenueReviewNew = "VENUE_REVIEW_NEW";

    /// <summary>Chủ sân vừa phản hồi đánh giá — gửi cho người chơi.</summary>
    public const string VenueReviewReply = "VENUE_REVIEW_REPLY";

    // ── Reminders ────────────────────────────────────────────────────
    /// <summary>Nhắc người chơi sắp đến giờ đánh cầu (background job).</summary>
    public const string UpcomingBooking = "UPCOMING_BOOKING";

    /// <summary>Người chơi giục chủ sân duyệt đơn PENDING.</summary>
    public const string BookingManagerReminder = "BOOKING_MANAGER_REMINDER";

    /// <summary>Admin yêu cầu hoàn tiền — gửi cho người chơi (khiếu nại BOOKING).</summary>
    public const string DisputeRefundPendingPlayer = "DISPUTE_REFUND_PENDING_PLAYER";

    /// <summary>Admin yêu cầu hoàn tiền — gửi cho chủ sân (khiếu nại BOOKING).</summary>
    public const string DisputeRefundPendingManager = "DISPUTE_REFUND_PENDING_MANAGER";

    /// <summary>Báo cáo vi phạm đã được xử lý xong — gửi cho người báo cáo.</summary>
    public const string ReportResolved = "REPORT_RESOLVED";

    /// <summary>Báo cáo vi phạm bị bác bỏ — gửi cho người báo cáo.</summary>
    public const string ReportRejected = "REPORT_REJECTED";

    /// <summary>Thông báo về hành động xử lý vi phạm — gửi cho đối tượng bị báo cáo.</summary>
    public const string ReportTargetAction = "REPORT_TARGET_ACTION";
}

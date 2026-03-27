using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class Booking
{
    public Guid Id { get; set; }

    public Guid? UserId { get; set; }

    public Guid? VenueId { get; set; }

    /// <summary>Đơn thuộc lịch dài hạn (nếu có).</summary>
    public Guid? SeriesId { get; set; }

    public string? Status { get; set; }

    public decimal? TotalAmount { get; set; }

    public decimal? DiscountAmount { get; set; }

    public decimal? FinalAmount { get; set; }

    public DateTime? CreatedAt { get; set; }

    /// <summary>Liên hệ tại thời điểm đặt (có thể khác hồ sơ tài khoản).</summary>
    public string? ContactName { get; set; }

    public string? ContactPhone { get; set; }

    public string? GuestNote { get; set; }

    /// <summary>Ghi chú từ sân khi từ chối / huỷ (manager), hiển thị cho người chơi.</summary>
    public string? ManagerStatusNote { get; set; }

    /// <summary>JSON snapshot chính sách huỷ/refund tại thời điểm tạo đơn.</summary>
    public string? CancellationPolicySnapshotJson { get; set; }

    public virtual ICollection<BookingItem> BookingItems { get; set; } = new List<BookingItem>();

    public virtual ICollection<MatchingPost> MatchingPosts { get; set; } = new List<MatchingPost>();

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<RefundRequest> RefundRequests { get; set; } = new List<RefundRequest>();

    public virtual User? User { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual BookingSeries? Series { get; set; }

    public virtual ICollection<VenueReview> VenueReviews { get; set; } = new List<VenueReview>();
}

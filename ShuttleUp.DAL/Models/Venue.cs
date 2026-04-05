using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class Venue
{
    public Guid Id { get; set; }

    public Guid? OwnerUserId { get; set; }

    public string Name { get; set; } = null!;

    public string Address { get; set; } = null!;

    public decimal? Lat { get; set; }

    public decimal? Lng { get; set; }

    public string? ContactName { get; set; }

    public string? ContactPhone { get; set; }

    public string? Description { get; set; }

    /// <summary>JSON array of strings — những gì khách được sử dụng khi thuê sân.</summary>
    public string? Includes { get; set; }

    /// <summary>JSON array of strings — các quy định tại cơ sở.</summary>
    public string? Rules { get; set; }

    /// <summary>JSON array of string keys — tiện ích có tại cơ sở (parking, wifi, ...).</summary>
    public string? Amenities { get; set; }

    public decimal? WeeklyDiscountPercent { get; set; }

    public decimal? MonthlyDiscountPercent { get; set; }

    /// <summary>Tên ngân hàng hiển thị (VD: Vietcombank).</summary>
    public string? PaymentBankName { get; set; }

    /// <summary>Mã BIN 6 số cho VietQR (VD: 970436). Có thể để trống nếu map từ tên NH.</summary>
    public string? PaymentBankBin { get; set; }

    public string? PaymentAccountNumber { get; set; }

    public string? PaymentAccountHolder { get; set; }

    public string? PaymentTransferNoteTemplate { get; set; }

    /// <summary>Ghi chú hướng dẫn thanh toán cho người chơi.</summary>
    public string? PaymentNote { get; set; }

    public bool CancelAllowed { get; set; } = true;

    public int CancelBeforeMinutes { get; set; } = 120;

    /// <summary>NONE | PERCENT | FULL</summary>
    public string RefundType { get; set; } = "NONE";

    public decimal? RefundPercent { get; set; }

    public bool? IsActive { get; set; }

    public DateTime? CreatedAt { get; set; }

    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    public virtual ICollection<BookingSeries> BookingSeries { get; set; } = new List<BookingSeries>();

    public virtual ICollection<Court> Courts { get; set; } = new List<Court>();

    public virtual ICollection<FavoriteVenue> FavoriteVenues { get; set; } = new List<FavoriteVenue>();

    public virtual User? OwnerUser { get; set; }

    public virtual ICollection<VenueCoupon> VenueCoupons { get; set; } = new List<VenueCoupon>();



    public virtual ICollection<VenueOpenHour> VenueOpenHours { get; set; } = new List<VenueOpenHour>();

    public virtual ICollection<VenueReview> VenueReviews { get; set; } = new List<VenueReview>();

    public virtual ICollection<File> Files { get; set; } = new List<File>();

    public virtual ICollection<MatchingPost> MatchingPosts { get; set; } = new List<MatchingPost>();
}

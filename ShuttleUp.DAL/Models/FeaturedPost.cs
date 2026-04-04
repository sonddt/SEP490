using System;

namespace ShuttleUp.DAL.Models;

/// <summary>
/// Bài đăng quảng cáo / tin nổi bật trên trang công khai (do Admin hoặc Manager đăng).
/// </summary>
public partial class FeaturedPost
{
    public Guid Id { get; set; }

    public string Title { get; set; } = null!;

    public string? Excerpt { get; set; }

    public string? Body { get; set; }

    public string? CoverImageUrl { get; set; }

    /// <summary>Link CTA ngoài (đặt sân, landing, v.v.).</summary>
    public string? LinkUrl { get; set; }

    public bool IsPublished { get; set; }

    /// <summary>Hiển thị từ thời điểm này (null = không giới hạn đầu).</summary>
    public DateTime? DisplayFrom { get; set; }

    /// <summary>Hiển thị đến hết thời điểm này (null = không giới hạn cuối).</summary>
    public DateTime? DisplayUntil { get; set; }

    public Guid AuthorUserId { get; set; }

    /// <summary>ADMIN hoặc MANAGER.</summary>
    public string AuthorRole { get; set; } = null!;

    /// <summary>Tùy chọn: gắn bài với một cụm sân (Manager thường chọn sân của mình).</summary>
    public Guid? VenueId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User AuthorUser { get; set; } = null!;

    public virtual Venue? Venue { get; set; }
}

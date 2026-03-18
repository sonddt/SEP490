using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Review;

public class CreateReviewRequestDto
{
    /// <summary>
    /// Id của booking mà bạn muốn đánh giá.
    /// Điều kiện:
    /// - Booking này phải thuộc về chính user đang đăng nhập
    /// - Booking ở đúng venue đang được review
    /// - Trạng thái booking = "CONFIRMED"
    /// - Không quá 3 ngày kể từ khi booking được tạo
    /// </summary>
    [Required]
    public Guid BookingId { get; set; }

    [Required]
    [Range(1, 5, ErrorMessage = "Số sao phải từ 1 đến 5.")]
    public int Stars { get; set; }

    [MaxLength(1000, ErrorMessage = "Nhận xét tối đa 1000 ký tự.")]
    public string? Comment { get; set; }
}

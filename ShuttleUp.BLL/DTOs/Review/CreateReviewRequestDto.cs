using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Review;

public class CreateReviewRequestDto
{
    [Required]
    [Range(1, 5, ErrorMessage = "Số sao phải từ 1 đến 5.")]
    public int Stars { get; set; }

    [MaxLength(1000, ErrorMessage = "Nhận xét tối đa 1000 ký tự.")]
    public string? Comment { get; set; }
}

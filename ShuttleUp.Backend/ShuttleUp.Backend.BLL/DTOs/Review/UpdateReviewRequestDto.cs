using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Review;

public class UpdateReviewRequestDto
{
    [Required]
    [Range(1, 5, ErrorMessage = "Số sao phải từ 1 đến 5.")]
    public int Stars { get; set; }

    [MaxLength(1000, ErrorMessage = "Nhận xét tối đa 1000 ký tự.")]
    public string? Comment { get; set; }

    /// <summary>Thay thế toàn bộ ảnh đính kèm (tối đa 5 file đã upload).</summary>
    public List<Guid>? FileIds { get; set; }
}

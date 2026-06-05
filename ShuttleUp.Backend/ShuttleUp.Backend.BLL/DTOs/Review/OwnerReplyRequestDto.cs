using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Review;

public class OwnerReplyRequestDto
{
    [MaxLength(1000, ErrorMessage = "Phản hồi tối đa 1000 ký tự.")]
    public string? Reply { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Auth;

public class SetPasswordRequestDto
{
    [Required(ErrorMessage = "Bạn chưa nhập mật khẩu mới.")]
    [MinLength(6, ErrorMessage = "Mật khẩu cần từ 6 ký tự trở lên bạn nhé.")]
    public string NewPassword { get; set; } = null!;

    [Required(ErrorMessage = "Bạn chưa xác nhận mật khẩu.")]
    [Compare("NewPassword", ErrorMessage = "Mật khẩu xác nhận chưa khớp nhau rồi!")]
    public string ConfirmPassword { get; set; } = null!;
}

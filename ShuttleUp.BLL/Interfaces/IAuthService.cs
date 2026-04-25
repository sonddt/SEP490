using ShuttleUp.BLL.DTOs.Auth;

namespace ShuttleUp.BLL.Interfaces;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto request);
    Task<LoginResponseDto> RegisterAsync(RegisterRequestDto request);
    Task<bool> CheckEmailExistsAsync(string email);
    Task<bool> CheckPhoneExistsAsync(string phone);

    /// <summary>
    /// Đăng nhập / đăng ký qua Google ID token.
    /// Nếu email chưa tồn tại → tạo tài khoản mới với roles được chỉ định.
    /// Nếu đã tồn tại → đăng nhập bình thường.
    /// </summary>
    Task<LoginResponseDto> GoogleLoginAsync(GoogleLoginRequestDto request);

    /// <summary>Gửi email chứa link đặt lại mật khẩu (token có hiệu lực 15 phút)</summary>
    Task ForgotPasswordAsync(ForgotPasswordRequestDto request);

    /// <summary>Đặt lại mật khẩu bằng token nhận từ email</summary>
    Task ResetPasswordAsync(ResetPasswordRequestDto request);

    /// <summary>Đổi mật khẩu khi đã đăng nhập (cần userId từ JWT)</summary>
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequestDto request);
}

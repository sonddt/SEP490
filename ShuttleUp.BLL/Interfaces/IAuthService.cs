using ShuttleUp.BLL.DTOs.Auth;

namespace ShuttleUp.BLL.Interfaces;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto request);
    Task<LoginResponseDto> RegisterAsync(RegisterRequestDto request);

    /// <summary>
    /// Đăng nhập / đăng ký qua Google ID token.
    /// Nếu email chưa tồn tại → tạo tài khoản mới với roles được chỉ định.
    /// Nếu đã tồn tại → đăng nhập bình thường.
    /// </summary>
    Task<LoginResponseDto> GoogleLoginAsync(GoogleLoginRequestDto request);
}

namespace ShuttleUp.BLL.DTOs.Auth;

public class LoginResponseDto
{
    public string AccessToken { get; set; } = null!;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresInMinutes { get; set; }
    public UserInfoDto User { get; set; } = null!;
}

public class UserInfoDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? PhoneNumber { get; set; }
    public IEnumerable<string> Roles { get; set; } = [];
    public string AuthProvider { get; set; } = "LOCAL";
    /// <summary>true khi user đã có PasswordHash (kể cả tài khoản Google đã「Thêm mật khẩu」).</summary>
    public bool HasPassword { get; set; }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ShuttleUp.BLL.DTOs.Auth;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IEmailService _emailService;
    private readonly IManagerProfileRequestRepository _managerProfileRequestRepository;
    private readonly IConfiguration _configuration;

    public AuthService(
        IUserRepository userRepository,
        IRoleRepository roleRepository,
        IEmailService emailService,
        IManagerProfileRequestRepository managerProfileRequestRepository,
        IConfiguration configuration)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _emailService = emailService;
        _managerProfileRequestRepository = managerProfileRequestRepository;
        _configuration = configuration;
    }

    // ── Đăng nhập bằng email/SĐT + mật khẩu ─────────────────────────────────
    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request)
    {
        User? user = null;

        if (!string.IsNullOrWhiteSpace(request.Email))
            user = await _userRepository.GetByEmailAsync(request.Email);
        else if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
            user = await _userRepository.GetByPhoneAsync(request.PhoneNumber);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash)
            || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Email/SĐT hoặc mật khẩu không đúng.");

        if (user.IsActive == false)
            throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");

        return BuildLoginResponse(user);
    }

    // ── Đăng ký bằng email + mật khẩu ───────────────────────────────────────
    public async Task<LoginResponseDto> RegisterAsync(RegisterRequestDto request)
    {
        var existing = await _userRepository.GetByEmailAsync(request.Email);
        if (existing != null)
            throw new InvalidOperationException("Email đã được sử dụng.");

        // Mặc định, mọi tài khoản đăng ký mới đều có Role PLAYER
        var roles = await ResolveRolesAsync(["PLAYER"]);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            Gender = request.Gender,
            DateOfBirth = request.DateOfBirth,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Roles = roles,
        };

        await _userRepository.AddAsync(user);

        // Nếu họ chọn đăng ký làm Manager, tạo hồ sơ (ManagerProfile) để Admin duyệt
        // Lưu ý: KHÔNG gán role MANAGER tại thời điểm đăng ký
        if (request.IsManagerRoleRequested)
        {
            var existingPending = await _managerProfileRequestRepository.GetPendingByUserIdAsync(user.Id);
            if (existingPending == null)
            {
                await _managerProfileRequestRepository.AddAsync(new ManagerProfileRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    RequestType = "DANG_KY",
                    Status = "PENDING",
                    RequestedAt = DateTime.UtcNow
                });
            }
        }

        return BuildLoginResponse(user);
    }

    // ── Đăng nhập / đăng ký qua Google ──────────────────────────────────────
    public async Task<LoginResponseDto> GoogleLoginAsync(GoogleLoginRequestDto request)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_configuration["Google:ClientId"]!]
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings);
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedAccessException("Google token không hợp lệ hoặc đã hết hạn.");
        }

        var email = payload.Email;
        var user = await _userRepository.GetByEmailAsync(email);

        if (user != null)
        {
            // User đã tồn tại → đăng nhập
            if (user.IsActive == false)
                throw new UnauthorizedAccessException("Tài khoản đã bị khóa.");

            return BuildLoginResponse(user);
        }

        // User chưa tồn tại → tạo tài khoản mới
        // Nếu FE yêu cầu MANAGER, vẫn chỉ gán PLAYER và tạo ManagerProfile ở trạng thái PENDING
        var wantsManager = request.Roles.Any(r => r.Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
        var roles = await ResolveRolesAsync(["PLAYER"]);

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = string.Empty,   // không có mật khẩu, chỉ login qua Google
            FullName = payload.Name ?? email,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            Roles = roles,
        };

        await _userRepository.AddAsync(newUser);

        if (wantsManager)
        {
            var existingPending = await _managerProfileRequestRepository.GetPendingByUserIdAsync(newUser.Id);
            if (existingPending == null)
            {
                await _managerProfileRequestRepository.AddAsync(new ManagerProfileRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = newUser.Id,
                    RequestType = "DANG_KY",
                    Status = "PENDING",
                    RequestedAt = DateTime.UtcNow
                });
            }
        }

        return BuildLoginResponse(newUser);
    }

    // ── Forgot Password ───────────────────────────────────────────────────────
    public async Task ForgotPasswordAsync(ForgotPasswordRequestDto request)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email);
        // Luôn trả 200 dù email không tồn tại (bảo mật, không lộ email)
        if (user == null) return;

        var token = GeneratePasswordResetToken(user);
        var frontendUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";
        var resetLink = $"{frontendUrl}/change-password?token={Uri.EscapeDataString(token)}";

        await _emailService.SendPasswordResetEmailAsync(user.Email, user.FullName, resetLink);
    }

    // ── Reset Password (từ link email) ────────────────────────────────────────
    public async Task ResetPasswordAsync(ResetPasswordRequestDto request)
    {
        var userId = ValidatePasswordResetToken(request.Token);

        var user = await _userRepository.GetByIdAsync(userId)
            ?? throw new InvalidOperationException("Tài khoản không tồn tại.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
    }

    // ── Change Password (đã đăng nhập) ────────────────────────────────────────
    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequestDto request)
    {
        var user = await _userRepository.GetByIdAsync(userId)
            ?? throw new InvalidOperationException("Tài khoản không tồn tại.");

        if (string.IsNullOrEmpty(user.PasswordHash)
            || !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAccessException("Mật khẩu hiện tại không đúng.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepository.UpdateAsync(user);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Lấy danh sách Role entity từ DB theo tên.
    /// Ném exception nếu có tên role không tồn tại trong DB.
    /// </summary>
    private async Task<List<Role>> ResolveRolesAsync(IEnumerable<string> roleNames)
    {
        var normalized = roleNames
            .Select(r => r.ToUpperInvariant())
            .Distinct()
            .ToList();

        var roles = (await _roleRepository.GetByNamesAsync(normalized)).ToList();

        var notFound = normalized.Except(roles.Select(r => r.Name.ToUpperInvariant())).ToList();
        if (notFound.Count != 0)
            throw new InvalidOperationException(
                $"Role không tồn tại trong hệ thống: {string.Join(", ", notFound)}");

        return roles;
    }

    private LoginResponseDto BuildLoginResponse(User user)
    {
        var expiresInMinutes = int.Parse(_configuration["Jwt:ExpiresInMinutes"] ?? "60");
        var token = GenerateJwtToken(user, expiresInMinutes);

        return new LoginResponseDto
        {
            AccessToken = token,
            ExpiresInMinutes = expiresInMinutes,
            User = new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email,
                FullName = user.FullName,
                Roles = user.Roles.Select(r => r.Name),
            }
        };
    }

    private string GenerateJwtToken(User user, int expiresInMinutes)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        foreach (var role in user.Roles)
            claims.Add(new Claim(ClaimTypes.Role, role.Name));

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresInMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GeneratePasswordResetToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim("purpose", "password-reset"),
            ],
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private Guid ValidatePasswordResetToken(string token)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));

        var handler = new JwtSecurityTokenHandler();
        try
        {
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _configuration["Jwt:Issuer"],
                ValidAudience = _configuration["Jwt:Audience"],
                IssuerSigningKey = key,
            }, out var validated);

            var jwt = (JwtSecurityToken)validated;
            var purpose = jwt.Claims.FirstOrDefault(c => c.Type == "purpose")?.Value;

            if (purpose != "password-reset")
                throw new UnauthorizedAccessException("Token không hợp lệ.");

            var sub = jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value;
            return Guid.Parse(sub);
        }
        catch (SecurityTokenExpiredException)
        {
            throw new UnauthorizedAccessException("Link đã hết hạn. Vui lòng yêu cầu lại.");
        }
        catch (Exception)
        {
            throw new UnauthorizedAccessException("Token không hợp lệ.");
        }
    }
}

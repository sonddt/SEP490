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
    private readonly IConfiguration _configuration;

    public AuthService(
        IUserRepository userRepository,
        IRoleRepository roleRepository,
        IConfiguration configuration)
    {
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _configuration = configuration;
    }

    // ── Đăng nhập bằng email + mật khẩu ─────────────────────────────────────
    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash)
            || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");

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

        var roles = await ResolveRolesAsync(request.Roles);

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
        var roles = await ResolveRolesAsync(request.Roles);

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

        return BuildLoginResponse(newUser);
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
}

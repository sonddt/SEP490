using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;

    public ProfileController(ShuttleUpDbContext db)
    {
        _db = db;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User.FindFirst("sub")!.Value);

    /// <summary>
    /// Lấy profile người dùng + thông tin hồ sơ quản lý (nếu có) trong 1 lần gọi.
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = CurrentUserId;
        // Một số cột (about/address/district/province) có thể chưa tồn tại trong DB hiện tại.
        // Ta try lấy đầy đủ trước, nếu lỗi "Unknown column" thì fallback để FE vẫn hoạt động.
        try
        {
            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FullName,
                    u.About,
                    u.PhoneNumber,
                    u.Address,
                    u.District,
                    u.Province,
                    u.Gender,
                    u.DateOfBirth,
                    avatarUrl = u.AvatarFile != null ? u.AvatarFile.FileUrl : null,
                    createdAt = u.CreatedAt,
                    Roles = u.Roles.Select(r => r.Name)
                })
                .FirstOrDefaultAsync();

            if (user == null) return Unauthorized();

            var managerProfile = await _db.ManagerProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.UserId == userId);

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.Email,
                    user.FullName,
                    user.About,
                    user.PhoneNumber,
                    user.Address,
                    user.District,
                    user.Province,
                    user.Gender,
                    dateOfBirth = user.DateOfBirth?.ToString("yyyy-MM-dd"),
                    user.avatarUrl,
                    createdAt = user.createdAt
                },
                roles = user.Roles,
                managerProfile = managerProfile == null
                    ? null
                    : new
                    {
                        managerProfile.UserId,
                        managerProfile.IdCardNo,
                        managerProfile.TaxCode,
                        managerProfile.BusinessLicenseNo,
                        managerProfile.Address,
                        managerProfile.Status,
                        managerProfile.DecisionAt,
                        managerProfile.DecisionNote
                    }
            });
        }
        catch (Exception ex) when (ex.Message.Contains("Unknown column", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FullName,
                    u.PhoneNumber,
                    u.Gender,
                    u.DateOfBirth,
                    avatarUrl = u.AvatarFile != null ? u.AvatarFile.FileUrl : null,
                    createdAt = u.CreatedAt,
                    Roles = u.Roles.Select(r => r.Name)
                })
                .FirstOrDefaultAsync();

            if (user == null) return Unauthorized();

            var managerProfile = await _db.ManagerProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.UserId == userId);

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.Email,
                    user.FullName,
                    about = (string?)null,
                    user.PhoneNumber,
                    address = (string?)null,
                    district = (string?)null,
                    province = (string?)null,
                    user.Gender,
                    dateOfBirth = user.DateOfBirth?.ToString("yyyy-MM-dd"),
                    user.avatarUrl,
                    createdAt = user.createdAt
                },
                roles = user.Roles,
                managerProfile = managerProfile == null
                    ? null
                    : new
                    {
                        managerProfile.UserId,
                        managerProfile.IdCardNo,
                        managerProfile.TaxCode,
                        managerProfile.BusinessLicenseNo,
                        managerProfile.Address,
                        managerProfile.Status,
                        managerProfile.DecisionAt,
                        managerProfile.DecisionNote
                    }
            });
        }
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = null!;
        public string? PhoneNumber { get; set; }
        public string? Gender { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? About { get; set; }
        public string? Address { get; set; }
        public string? District { get; set; }
        public string? Province { get; set; }
    }

    /// <summary>
    /// Cập nhật thông tin hồ sơ người dùng (không xử lý avatar ở bước này).
    /// </summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateProfileDto dto)
    {
        var userId = CurrentUserId;

        if (dto == null) return BadRequest();
        var fullName = (dto.FullName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fullName)) return BadRequest(new { message = "Họ và tên là bắt buộc." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        user.FullName = fullName;
        user.PhoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber) ? null : dto.PhoneNumber.Trim();
        user.Gender = string.IsNullOrWhiteSpace(dto.Gender) ? null : dto.Gender.Trim();
        user.DateOfBirth = dto.DateOfBirth;
        // Lưu base fields trước để tránh trường hợp một số cột (about/address/...) chưa có.
        await _db.SaveChangesAsync();

        try
        {
            user.About = string.IsNullOrWhiteSpace(dto.About) ? null : dto.About.Trim();
            user.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
            user.District = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim();
            user.Province = string.IsNullOrWhiteSpace(dto.Province) ? null : dto.Province.Trim();

            await _db.SaveChangesAsync();
        }
        catch (Exception ex) when (ex.Message.Contains("Unknown column", StringComparison.OrdinalIgnoreCase))
        {
            // Nếu DB chưa có cột about/address/..., ít nhất base profile vẫn được cập nhật.
            return Ok(new { message = "Cập nhật hồ sơ thành công (một số trường phụ có thể chưa cập nhật do DB thiếu cột)." });
        }

        return Ok(new { message = "Cập nhật hồ sơ thành công." });
    }
}


using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly IConfiguration _config;

    public ProfileController(ShuttleUpDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
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

    /// <summary>
    /// Upload avatar (multipart/form-data) -> Cloudinary -> lưu bảng files -> update users.avatar_file_id.
    /// </summary>
    [HttpPost("avatar")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadAvatar(IFormFile avatar)
    {
        var userId = CurrentUserId;
        if (avatar == null || avatar.Length <= 0)
            return BadRequest(new { message = "Không tìm thấy file avatar." });

        if (avatar.ContentType == null || !avatar.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Avatar phải là file ảnh." });

        var cloudName = _config["Cloudinary:CloudName"]?.Trim();
        var apiKey = _config["Cloudinary:ApiKey"]?.Trim();
        var apiSecret = _config["Cloudinary:ApiSecret"]?.Trim();
        var folder = _config["Cloudinary:Folder"]?.Trim();

        if (string.IsNullOrWhiteSpace(cloudName))
        {
            return StatusCode(500, new { message = "Chưa cấu hình Cloudinary trên server (CloudName)." });
        }

        // Fallback: upload có chữ ký (signed upload).
        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
        {
            return StatusCode(500, new { message = "Chưa cấu hình Cloudinary trên server (ApiKey/ApiSecret)." });
        }

        var account = new Account(cloudName, apiKey, apiSecret);
        var cloudinary = new Cloudinary(account);

        using var signedStream = avatar.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(avatar.FileName, signedStream),
            Folder = string.IsNullOrWhiteSpace(folder) ? "avatars" : folder,
        };

        dynamic result;
        try
        {
            result = await cloudinary.UploadAsync(uploadParams);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
        }

        if (result == null)
            return StatusCode(500, new { message = "Upload Cloudinary thất bại: result null." });

        if (string.IsNullOrWhiteSpace(result.SecureUrl?.ToString()))
        {
            var errMsg = result.Error?.Message ?? result.Error?.ToString() ?? "SecureUrl is null";
            return StatusCode(500, new { message = "Upload Cloudinary thất bại: " + errMsg });
        }

        var file = new ShuttleUp.DAL.Models.File
        {
            Id = Guid.NewGuid(),
            FileUrl = result.SecureUrl.ToString(),
            FileName = avatar.FileName,
            MimeType = avatar.ContentType,
            FileSize = (int?)avatar.Length,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Files.Add(file);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        user.AvatarFileId = file.Id;

        await _db.SaveChangesAsync();

        return Ok(new { avatarUrl = file.FileUrl });
    }
}


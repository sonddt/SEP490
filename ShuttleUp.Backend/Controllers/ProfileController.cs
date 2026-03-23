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
using DalFile = ShuttleUp.DAL.Models.File;

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

            var fileIds = new List<Guid>();
            if (managerProfile?.CccdFrontFileId != null) fileIds.Add(managerProfile.CccdFrontFileId.Value);
            if (managerProfile?.CccdBackFileId != null) fileIds.Add(managerProfile.CccdBackFileId.Value);
            if (managerProfile?.BusinessLicenseFileId1 != null) fileIds.Add(managerProfile.BusinessLicenseFileId1.Value);
            if (managerProfile?.BusinessLicenseFileId2 != null) fileIds.Add(managerProfile.BusinessLicenseFileId2.Value);
            if (managerProfile?.BusinessLicenseFileId3 != null) fileIds.Add(managerProfile.BusinessLicenseFileId3.Value);

            var files = fileIds.Count == 0
                ? new List<DalFile>()
                : await _db.Files.AsNoTracking().Where(f => fileIds.Contains(f.Id)).ToListAsync();
            var fileDict = files.ToDictionary(f => f.Id, f => f);

            DalFile? GetFile(Guid? id) => id != null && fileDict.TryGetValue(id.Value, out var f) ? f : null;

            var cccdFront = GetFile(managerProfile?.CccdFrontFileId);
            var cccdBack = GetFile(managerProfile?.CccdBackFileId);
            var bl1 = GetFile(managerProfile?.BusinessLicenseFileId1);
            var bl2 = GetFile(managerProfile?.BusinessLicenseFileId2);
            var bl3 = GetFile(managerProfile?.BusinessLicenseFileId3);

            var businessLicenseFiles = new[] { bl1, bl2, bl3 }
                .Where(x => x != null)
                .Select(x => new { url = x!.FileUrl, mimeType = x!.MimeType, id = x.Id })
                .ToList();

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
                        managerProfile.TaxCode,
                        managerProfile.Address,
                        managerProfile.Status,
                        managerProfile.DecisionAt,
                        managerProfile.DecisionNote,

                        cccdFrontUrl = cccdFront?.FileUrl,
                        cccdBackUrl = cccdBack?.FileUrl,
                        businessLicenseFiles
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
                // DB cũ không có các cột manager docs theo schema mới nên không thể map đầy đủ.
                managerProfile = (object?)null
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

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret))
        {
            return StatusCode(500, new { message = "Chưa cấu hình Cloudinary trên server (ApiKey/ApiSecret)." });
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        // Public ID cố định theo yêu cầu: user_avatar_{userId}
        var publicId = $"user_avatar_{userId}";
        var targetFolder = string.IsNullOrWhiteSpace(folder) ? "avatars" : folder;

        var account = new Account(cloudName, apiKey, apiSecret);
        var cloudinary = new Cloudinary(account);

        // Upload + transform trực tiếp để đảm bảo ảnh avatar luôn có kích thước 200x200 và format webp.
        using var stream = avatar.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(avatar.FileName, stream),
            Folder = targetFolder,
            PublicId = publicId,
            Overwrite = true,
            Invalidate = true,
            Transformation = new Transformation()
                .Crop("fill")
                .Gravity("face")
                .Width(200)
                .Height(200)
                .FetchFormat("webp")
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

        var secureUrl = result.SecureUrl?.ToString();
        if (string.IsNullOrWhiteSpace(secureUrl))
        {
            var errMsg = result.Error?.Message ?? result.Error?.ToString() ?? "SecureUrl is null";
            return StatusCode(500, new { message = "Upload Cloudinary thất bại: " + errMsg });
        }

        // Logic database theo chiến lược: chỉ "ghi nhận" record avatar lần đầu.
        // (DB hiện tại không có cột Users.AvatarUrl; thay vào đó dùng users.avatar_file_id => files.FileUrl.)
        if (user.AvatarFileId == null)
        {
            var file = new ShuttleUp.DAL.Models.File
            {
                Id = Guid.NewGuid(),
                FileUrl = secureUrl,   // secure_url của phiên bản đã transform
                FileName = $"avatar_{userId}",
                MimeType = avatar.ContentType,
                FileSize = (int?)avatar.Length,
                UploadedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _db.Files.Add(file);
            user.AvatarFileId = file.Id;
            await _db.SaveChangesAsync();
        }
        else
        {
            // URL có thể thay đổi do upload overwrite/versioning; nếu cần đảm bảo avatar "luôn đúng ngay",
            // có thể update lại FileUrl. Dù không tạo thêm record mới.
            var existingFile = await _db.Files.FirstOrDefaultAsync(f => f.Id == user.AvatarFileId);
            if (existingFile != null && existingFile.FileUrl != secureUrl)
            {
                existingFile.FileUrl = secureUrl;
                await _db.SaveChangesAsync();
            }
        }

        return Ok(new { avatarUrl = secureUrl });
    }
}


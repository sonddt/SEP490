using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly IFileService _fileService;

    public ProfileController(ShuttleUpDbContext db, IFileService fileService)
    {
        _db = db;
        _fileService = fileService;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    private static bool IsUnknownColumnException(Exception ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e.Message.Contains("Unknown column", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    /// <summary>
    /// Lấy profile người dùng + thông tin hồ sơ quản lý (nếu có) trong 1 lần gọi.
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });
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
                    u.SkillLevel,
                    u.PlayPurpose,
                    u.PlayFrequency,
                    u.IsPersonalized,
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
                    user.SkillLevel,
                    user.PlayPurpose,
                    user.PlayFrequency,
                    user.IsPersonalized,
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

    /// <summary>
    /// Hồ sơ công khai của user khác + trạng thái quan hệ với người đang xem (đồng bộ logic Social).
    /// </summary>
    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> GetPublicProfile(Guid userId)
    {
        if (!TryGetCurrentUserId(out var viewerId))
            return Unauthorized();
        if (userId == viewerId)
            return BadRequest(new { message = "Để xem hồ sơ của bạn, dùng mục Hồ sơ của tôi." });

        var target = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.IsActive != false)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.SkillLevel,
                u.PlayPurpose,
                u.PlayFrequency,
                avatarUrl = u.AvatarFile != null ? u.AvatarFile.FileUrl : null
            })
            .FirstOrDefaultAsync();
        if (target == null)
            return NotFound(new { message = "Không tìm thấy người dùng." });

        static (Guid Low, Guid High) OrderedPair(Guid a, Guid b) =>
            string.Compare(a.ToString("D"), b.ToString("D"), StringComparison.Ordinal) < 0 ? (a, b) : (b, a);

        string relationshipState;
        Guid? pendingRequestId = null;

        if (await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == viewerId && b.BlockedId == userId))
            relationshipState = "BLOCKED_BY_ME";
        else if (await _db.UserBlocks.AsNoTracking().AnyAsync(b => b.BlockerId == userId && b.BlockedId == viewerId))
            relationshipState = "BLOCKED_BY_THEM";
        else
        {
            var (low, high) = OrderedPair(viewerId, userId);
            if (await _db.Friendships.AsNoTracking().AnyAsync(f => f.UserLowId == low && f.UserHighId == high))
                relationshipState = "FRIENDS";
            else if (await _db.FriendRequests.AsNoTracking().AnyAsync(r =>
                         r.Status == "PENDING" && r.FromUserId == viewerId && r.ToUserId == userId))
                relationshipState = "PENDING_OUT";
            else if (await _db.FriendRequests.AsNoTracking().AnyAsync(r =>
                         r.Status == "PENDING" && r.FromUserId == userId && r.ToUserId == viewerId))
            {
                relationshipState = "PENDING_IN";
                pendingRequestId = await _db.FriendRequests.AsNoTracking()
                    .Where(r => r.Status == "PENDING" && r.FromUserId == userId && r.ToUserId == viewerId)
                    .Select(r => r.Id)
                    .FirstAsync();
            }
            else
                relationshipState = "NONE";
        }

        return Ok(new
        {
            user = new
            {
                target.Id,
                target.FullName,
                target.SkillLevel,
                target.PlayPurpose,
                target.PlayFrequency,
                target.avatarUrl
            },
            relationshipState,
            pendingRequestId
        });
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = null!;
        public string? PhoneNumber { get; set; }
        public string? Gender { get; set; }
        /// <summary>Định dạng yyyy-MM-dd hoặc để trống — tránh lỗi bind JSON với DateOnly.</summary>
        public string? DateOfBirth { get; set; }
        public string? About { get; set; }
        public string? Address { get; set; }
        public string? District { get; set; }
        public string? Province { get; set; }
        
        public string? SkillLevel { get; set; }
        public string? PlayPurpose { get; set; }
        public string? PlayFrequency { get; set; }
        public bool? IsPersonalized { get; set; }
    }

    /// <summary>
    /// Cập nhật thông tin hồ sơ người dùng (không xử lý avatar ở bước này).
    /// </summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateProfileDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });

        if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu cập nhật." });
        var fullName = (dto.FullName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fullName)) return BadRequest(new { message = "Họ và tên là bắt buộc." });

        DateOnly? parsedDob = null;
        if (!string.IsNullOrWhiteSpace(dto.DateOfBirth))
        {
            if (!DateOnly.TryParse(dto.DateOfBirth.Trim(), out var dob))
                return BadRequest(new { message = "Ngày sinh không hợp lệ (dùng định dạng yyyy-MM-dd)." });
            parsedDob = dob;
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized(new { message = "Không tìm thấy tài khoản." });

        var phone = string.IsNullOrWhiteSpace(dto.PhoneNumber) ? null : dto.PhoneNumber.Trim();

        // Validate uniqueness: số điện thoại phải không trùng với user khác
        // (email có UNIQUE index nhưng phone_number thì hiện chưa có, nên check ở backend)
        try
        {
            if (!string.IsNullOrWhiteSpace(phone))
            {
                var phoneInUse = await _db.Users.AnyAsync(u =>
                    u.Id != userId &&
                    u.PhoneNumber != null &&
                    u.PhoneNumber == phone);

                if (phoneInUse)
                    return BadRequest(new { message = "Số điện thoại đã được sử dụng." });
            }
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
            // DB cũ thiếu cột phone_number thì bỏ qua validate trùng,
            // phần update vẫn nằm trong luồng SaveChanges/raw SQL phía dưới.
        }

        user.FullName = fullName;
        user.PhoneNumber = phone;
        user.Gender = string.IsNullOrWhiteSpace(dto.Gender) ? null : dto.Gender.Trim();
        user.DateOfBirth = parsedDob;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
            // DB cũ thiếu gender / date_of_birth / ... — vẫn lưu được họ tên + SĐT.
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE users SET full_name = {fullName}, phone_number = {phone} WHERE id = {userId}");
            return Ok(new
            {
                message =
                    "Cập nhật họ tên và số điện thoại thành công. (Một số cột khác trên DB có thể chưa đồng bộ — chạy script Database.txt mới nhất.)"
            });
        }

        try
        {
            user.About = string.IsNullOrWhiteSpace(dto.About) ? null : dto.About.Trim();
            user.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
            user.District = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim();
            user.Province = string.IsNullOrWhiteSpace(dto.Province) ? null : dto.Province.Trim();

            // Cập nhật các trường Personalization
            if (dto.SkillLevel != null) user.SkillLevel = dto.SkillLevel.Trim();
            if (dto.PlayPurpose != null) user.PlayPurpose = dto.PlayPurpose.Trim();
            if (dto.PlayFrequency != null) user.PlayFrequency = dto.PlayFrequency.Trim();
            if (dto.IsPersonalized.HasValue) user.IsPersonalized = dto.IsPersonalized.Value;

            await _db.SaveChangesAsync();
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
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
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });
        if (avatar == null || avatar.Length <= 0)
            return BadRequest(new { message = "Không tìm thấy file avatar." });

        if (avatar.ContentType == null || !avatar.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Avatar phải là file ảnh." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Unauthorized();

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadAvatarAsync(avatar, userId, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
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


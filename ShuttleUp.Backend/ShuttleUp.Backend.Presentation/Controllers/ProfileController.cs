using System;
using System.Security.Claims;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Profile;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    /// <summary>
    /// Lấy profile người dùng + thông tin hồ sơ quản lý (nếu có) trong 1 lần gọi.
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });
            
        var profile = await _profileService.GetMyProfileAsync(userId);
        if (profile == null) return Unauthorized();

        return Ok(new
        {
            user = new
            {
                profile.User.Id,
                profile.User.Email,
                profile.User.FullName,
                profile.User.About,
                profile.User.PhoneNumber,
                profile.User.Address,
                profile.User.District,
                profile.User.Province,
                profile.User.Gender,
                dateOfBirth = profile.User.DateOfBirth,
                profile.User.SkillLevel,
                profile.User.PlayPurpose,
                profile.User.PlayFrequency,
                profile.User.IsPersonalized,
                avatarUrl = profile.User.AvatarUrl,
                createdAt = profile.User.CreatedAt
            },
            roles = profile.Roles,
            managerProfile = profile.ManagerProfile == null ? null : new
            {
                profile.ManagerProfile.UserId,
                profile.ManagerProfile.TaxCode,
                profile.ManagerProfile.Address,
                profile.ManagerProfile.Status,
                profile.ManagerProfile.DecisionAt,
                profile.ManagerProfile.DecisionNote,
                cccdFrontUrl = profile.ManagerProfile.CccdFrontUrl,
                cccdBackUrl = profile.ManagerProfile.CccdBackUrl,
                businessLicenseFiles = profile.ManagerProfile.BusinessLicenseFiles
            }
        });
    }

    /// <summary>
    /// Hồ sơ công khai của user khác + trạng thái quan hệ với người đang xem.
    /// </summary>
    [HttpGet("{userId:guid}")]
    public async Task<IActionResult> GetPublicProfile(Guid userId)
    {
        if (!TryGetCurrentUserId(out var viewerId))
            return Unauthorized();
            
        if (userId == viewerId)
            return BadRequest(new { message = "Để xem hồ sơ của bạn, dùng mục Hồ sơ của tôi." });

        var profile = await _profileService.GetPublicProfileAsync(userId, viewerId);
        if (profile == null)
            return NotFound(new { message = "Không tìm thấy người dùng." });

        return Ok(new
        {
            user = new
            {
                profile.User.Id,
                profile.User.FullName,
                profile.User.SkillLevel,
                profile.User.PlayPurpose,
                profile.User.PlayFrequency,
                avatarUrl = profile.User.AvatarUrl
            },
            relationshipState = profile.RelationshipState,
            pendingRequestId = profile.PendingRequestId
        });
    }

    /// <summary>
    /// Cập nhật thông tin hồ sơ người dùng.
    /// </summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateProfileDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });

        if (dto == null) return BadRequest(new { message = "Thiếu dữ liệu cập nhật." });
        if (string.IsNullOrWhiteSpace(dto.FullName)) return BadRequest(new { message = "Họ và tên là bắt buộc." });

        try
        {
            var result = await _profileService.UpdateMyProfileAsync(userId, dto);
            return Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (System.Collections.Generic.KeyNotFoundException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    /// <summary>
    /// Upload avatar (multipart/form-data) -> Cloudinary.
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

        try
        {
            var secureUrl = await _profileService.UploadAvatarAsync(userId, avatar, HttpContext.RequestAborted);
            return Ok(new { avatarUrl = secureUrl });
        }
        catch (System.Collections.Generic.KeyNotFoundException) { return Unauthorized(); }
        catch (Exception ex) { return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message }); }
    }
}

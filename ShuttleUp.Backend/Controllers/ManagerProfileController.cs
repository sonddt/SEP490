using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using System.Security.Claims;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager-profile")]
[Authorize]
public class ManagerProfileController : ControllerBase
{
    private readonly IManagerProfileRepository _repo;
    private readonly IUserRepository _users;

    public ManagerProfileController(IManagerProfileRepository repo, IUserRepository users)
    {
        _repo = repo;
        _users = users;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")!.Value);

    /// <summary>Thông tin hồ sơ quản lý của chính user</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = CurrentUserId;
        var profile = await _repo.GetByUserIdAsync(userId);
        if (profile == null)
        {
            return Ok(new
            {
                status = (string?)null
            });
        }

        return Ok(new
        {
            profile.UserId,
            profile.IdCardNo,
            profile.TaxCode,
            profile.BusinessLicenseNo,
            profile.Address,
            profile.Status,
            profile.DecisionAt,
            profile.DecisionNote
        });
    }

    public class UpdateManagerProfileDto
    {
        public string? IdCardNo { get; set; }
        public string? TaxCode { get; set; }
        public string? BusinessLicenseNo { get; set; }
        public string? Address { get; set; }
    }

    /// <summary>Cập nhật hồ sơ quản lý của chính user (giữ trạng thái PENDING)</summary>
    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateManagerProfileDto dto)
    {
        var userId = CurrentUserId;
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Unauthorized();

        var profile = await _repo.GetByUserIdAsync(userId);
        if (profile == null)
        {
            profile = new ManagerProfile
            {
                UserId = userId,
                Status = "PENDING"
            };
            await _repo.AddAsync(profile);
        }

        profile.IdCardNo = dto.IdCardNo ?? profile.IdCardNo;
        profile.TaxCode = dto.TaxCode ?? profile.TaxCode;
        profile.BusinessLicenseNo = dto.BusinessLicenseNo ?? profile.BusinessLicenseNo;
        profile.Address = dto.Address ?? profile.Address;
        // Giữ nguyên Status hiện tại, không đổi tại đây

        await _repo.UpdateAsync(profile);
        return Ok(new { message = "Cập nhật hồ sơ quản lý thành công.", status = profile.Status });
    }
}


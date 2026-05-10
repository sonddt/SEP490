using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;
using System.Security.Claims;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager-profile")]
[Authorize]
public class ManagerProfileController : ControllerBase
{
    private readonly IManagerProfileService _profileService;
    private readonly INotificationDispatchService _notify;
    private readonly IUserRepository _userRepo;

    public ManagerProfileController(IManagerProfileService profileService, INotificationDispatchService notify, IUserRepository userRepo)
    {
        _profileService = profileService; _notify = notify; _userRepo = userRepo;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")!.Value);

    /// <summary>Thông tin hồ sơ quản lý của chính user</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile() => Ok(await _profileService.GetProfileAsync(CurrentUserId));

    /// <summary>Cập nhật hồ sơ quản lý của chính user (gửi request PENDING)</summary>
    [HttpPut("me")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(25_000_000)]
    public async Task<IActionResult> UpdateMyProfile([FromForm] UpdateMyProfileUploadDto form)
    {
        var userId = CurrentUserId;
        try
        {
            // Convert IFormFile → FileUploadParam (decouple from ASP.NET)
            var updateParams = new ManagerProfileUpdateParams
            {
                TaxCode = form.TaxCode, Address = form.Address, RetainedLicenseIds = form.RetainedLicenseIds,
                CccdFrontFile = ToUploadParam(form.CccdFrontFile), CccdBackFile = ToUploadParam(form.CccdBackFile),
                BusinessLicenseFiles = form.BusinessLicenseFiles?.Where(f => f != null && f.Length > 0).Select(ToUploadParam).Where(p => p != null).Cast<FileUploadParam>().ToList()
            };
            var result = await _profileService.UpdateProfileAsync(userId, updateParams);

            // ── Notify admins (Controller-level cross-cutting) ──
            try
            {
                dynamic r = result;
                string userName = r.userName;
                string requestType = r.requestType;
                var adminIds = await _userRepo.GetAdminUserIdsAsync();
                var reqLabel = requestType == "CAP_NHAT" ? "cập nhật" : "đăng ký";
                foreach (var adminId in adminIds)
                    await _notify.NotifyUserAsync(adminId, NotificationTypes.ManagerRequestSubmitted,
                        $"Có hồ sơ {reqLabel} Chủ sân mới!", $"{userName} vừa gửi hồ sơ {reqLabel} Chủ sân. Bấm để xem chi tiết.",
                        metadata: new { deepLink = "/admin/manager-requests" });
            }
            catch { /* không block response nếu notify fail */ }

            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private static FileUploadParam? ToUploadParam(IFormFile? file)
    {
        if (file == null || file.Length == 0) return null;
        return new FileUploadParam { Stream = file.OpenReadStream(), FileName = file.FileName, ContentType = file.ContentType, Length = file.Length };
    }

    public class UpdateMyProfileUploadDto
    {
        public string? TaxCode { get; set; }
        public string? Address { get; set; }
        public IFormFile? CccdFrontFile { get; set; }
        public IFormFile? CccdBackFile { get; set; }
        public string? RetainedLicenseIds { get; set; }
        public List<IFormFile>? BusinessLicenseFiles { get; set; }
    }
}

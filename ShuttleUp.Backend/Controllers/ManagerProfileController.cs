using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using System.Security.Claims;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager-profile")]
[Authorize]
public class ManagerProfileController : ControllerBase
{
    private readonly IManagerProfileRepository _repo;
    private readonly IManagerProfileRequestRepository _requestRepo;
    private readonly IUserRepository _users;
    private readonly ShuttleUpDbContext _db;
    private readonly IConfiguration _config;
    private readonly INotificationDispatchService _notify;

    public ManagerProfileController(
        IManagerProfileRepository repo,
        IManagerProfileRequestRepository requestRepo,
        IUserRepository users,
        ShuttleUpDbContext db,
        IConfiguration config,
        INotificationDispatchService notify)
    {
        _repo = repo;
        _requestRepo = requestRepo;
        _users = users;
        _db = db;
        _config = config;
        _notify = notify;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")!.Value);

    /// <summary>Thông tin hồ sơ quản lý của chính user</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = CurrentUserId;
        var latestRequest = await _db.ManagerProfileRequests
            .AsNoTracking()
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync(r => r.UserId == userId);

        var snapshot = await _repo.GetByUserIdAsync(userId);

        // Nếu chưa có gì để duyệt thì trả status null (FE sẽ hiển thị form rỗng)
        if (latestRequest == null && snapshot == null)
            return Ok(new { status = (string?)null });

        var status = latestRequest?.Status ?? snapshot?.Status;
        var effectiveRequestType = latestRequest?.RequestType ??
                                    (snapshot?.Status == "APPROVED" ? "CAP_NHAT" : "DANG_KY");

        // Khi request đang PENDING, FE cần xem luôn docs đã upload (chưa duyệt).
        // Với các field không upload ở request mới thì fallback về snapshot.
        Guid? cccdFrontId = latestRequest?.CccdFrontFileId ?? snapshot?.CccdFrontFileId;
        Guid? cccdBackId = latestRequest?.CccdBackFileId ?? snapshot?.CccdBackFileId;
        Guid? bl1Id = latestRequest?.BusinessLicenseFileId1 ?? snapshot?.BusinessLicenseFileId1;
        Guid? bl2Id = latestRequest?.BusinessLicenseFileId2 ?? snapshot?.BusinessLicenseFileId2;
        Guid? bl3Id = latestRequest?.BusinessLicenseFileId3 ?? snapshot?.BusinessLicenseFileId3;

        var fileIds = new List<Guid>();
        if (cccdFrontId != null) fileIds.Add(cccdFrontId.Value);
        if (cccdBackId != null) fileIds.Add(cccdBackId.Value);
        if (bl1Id != null) fileIds.Add(bl1Id.Value);
        if (bl2Id != null) fileIds.Add(bl2Id.Value);
        if (bl3Id != null) fileIds.Add(bl3Id.Value);

        var files = fileIds.Count == 0
            ? new List<DalFile>()
            : await _db.Files.AsNoTracking()
                .Where(f => fileIds.Contains(f.Id))
                .ToListAsync();
        var fileDict = files.ToDictionary(f => f.Id, f => f);

        DalFile? GetFile(Guid? id) => id != null && fileDict.TryGetValue(id.Value, out var f) ? f : null;

        var cccdFront = GetFile(cccdFrontId);
        var cccdBack = GetFile(cccdBackId);
        var bl1 = GetFile(bl1Id);
        var bl2 = GetFile(bl2Id);
        var bl3 = GetFile(bl3Id);

        // tax/address ưu tiên request mới để FE xem ngay dữ liệu pending
        var taxCode = latestRequest?.TaxCode ?? snapshot?.TaxCode;
        var address = latestRequest?.Address ?? snapshot?.Address;

        var businessLicenseFiles = new[]
        {
            bl1, bl2, bl3
        }
        .Where(x => x != null)
        .Select(x => new
        {
            id = x!.Id,
            url = x.FileUrl,
            mimeType = x.MimeType
        })
        .ToList();

        return Ok(new
        {
            userId,
            status,
            requestType = effectiveRequestType,

            taxCode,
            address,

            cccdFrontUrl = cccdFront?.FileUrl,
            cccdBackUrl = cccdBack?.FileUrl,
            businessLicenseFiles,

            // decision từ latest request để FE hiển thị/badge nếu cần
            decisionAt = latestRequest?.DecisionAt,
            decisionNote = latestRequest?.DecisionNote
        });
    }

    private async Task<Guid> UploadFileAsync(IFormFile file, string folder, string publicIdBase)
    {
        var cloudName = _config["Cloudinary:CloudName"]?.Trim();
        var apiKey = _config["Cloudinary:ApiKey"]?.Trim();
        var apiSecret = _config["Cloudinary:ApiSecret"]?.Trim();
        if (string.IsNullOrWhiteSpace(cloudName) ||
            string.IsNullOrWhiteSpace(apiKey) ||
            string.IsNullOrWhiteSpace(apiSecret))
            throw new InvalidOperationException("Chưa cấu hình Cloudinary (CloudName/ApiKey/ApiSecret).");

        var account = new Account(cloudName, apiKey, apiSecret);
        var cloudinary = new Cloudinary(account);

        var fileId = Guid.NewGuid();
        var publicId = $"{publicIdBase}_{fileId}";

        using var stream = file.OpenReadStream();

        dynamic result;
        try
        {
            if (file.ContentType != null && file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = folder,
                    PublicId = publicId,
                    Overwrite = true,
                    Invalidate = true
                    // Không crop/transform để giữ nét giấy tờ theo yêu cầu.
                };
                result = await cloudinary.UploadAsync(uploadParams);
            }
            else
            {
                // PDF (Resource type raw)
                var uploadParams = new RawUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = folder,
                    PublicId = publicId,
                    Overwrite = true,
                    Invalidate = true
                };
                result = await cloudinary.UploadAsync(uploadParams);
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Cloudinary upload exception: " + ex.Message);
        }

        var secureUrl = result?.SecureUrl?.ToString();
        if (string.IsNullOrWhiteSpace(secureUrl))
            throw new InvalidOperationException("Cloudinary upload failed: secureUrl is null.");

        var fileEntity = new ShuttleUp.DAL.Models.File
        {
            Id = fileId,
            FileUrl = secureUrl,
            FileName = publicId,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = CurrentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Files.Add(fileEntity);
        return fileId;
    }

    /// <summary>Cập nhật hồ sơ quản lý của chính user (gửi request PENDING)</summary>
    [HttpPut("me")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(25_000_000)]
    public async Task<IActionResult> UpdateMyProfile([FromForm] UpdateMyProfileUploadDto form)
    {
        var userId = CurrentUserId;
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Unauthorized();

        var taxCode = form.TaxCode;
        var address = form.Address;
        var cccdFrontFile = form.CccdFrontFile;
        var cccdBackFile = form.CccdBackFile;
        var businessLicenseFiles = form.BusinessLicenseFiles;

        const long maxFileSizeBytes = 5 * 1024 * 1024;

        bool IsImage(string? contentType) =>
            !string.IsNullOrWhiteSpace(contentType) &&
            (contentType.StartsWith("image/jpeg", StringComparison.OrdinalIgnoreCase) ||
             contentType.StartsWith("image/png", StringComparison.OrdinalIgnoreCase));

        bool IsLicenseFile(IFormFile f) =>
            (f.ContentType != null && (f.ContentType.StartsWith("application/pdf", StringComparison.OrdinalIgnoreCase) ||
                                        IsImage(f.ContentType)));

        // Decide request type
        var snapshot = await _repo.GetByUserIdAsync(userId);
        var isApproved = string.Equals(snapshot?.Status, "APPROVED", StringComparison.OrdinalIgnoreCase);
        var requestType = isApproved ? "CAP_NHAT" : "DANG_KY";
        var isRegistration = requestType == "DANG_KY";

        // Lấy pending hiện tại để cho phép cập nhật "phần nào" mà không bắt buộc gửi lại toàn bộ giấy tờ.
        var pending = await _requestRepo.GetPendingByUserIdAsync(userId);

        var licenseFiles = (businessLicenseFiles ?? new List<IFormFile>())
            .Where(f => f != null && f.Length > 0)
            .ToList();

        var hasTaxCode = !string.IsNullOrWhiteSpace(taxCode);
        var hasAddress = !string.IsNullOrWhiteSpace(address);
        var hasCccdFront = cccdFrontFile != null && cccdFrontFile.Length > 0;
        var hasCccdBack = cccdBackFile != null && cccdBackFile.Length > 0;
        var hasLicenseUpload = licenseFiles.Count > 0;
        var hasLicenseRetainStr = form.RetainedLicenseIds != null;
        var hasAnyUpdate = hasTaxCode || hasAddress || hasCccdFront || hasCccdBack || hasLicenseUpload || hasLicenseRetainStr;

        // Validations theo request type
        if (!hasAnyUpdate)
            return BadRequest(new { message = "Bạn chưa cập nhật thông tin nào." });

        if (hasCccdFront || hasCccdBack)
        {
            if (!hasCccdFront || !hasCccdBack)
                return BadRequest(new { message = "Nếu upload CCCD thì cần đủ 2 mặt (mặt trước và mặt sau)." });

            if (!IsImage(cccdFrontFile!.ContentType))
                return BadRequest(new { message = "CCCD mặt trước phải là JPG hoặc PNG." });
            if (!IsImage(cccdBackFile!.ContentType))
                return BadRequest(new { message = "CCCD mặt sau phải là JPG hoặc PNG." });
            if (cccdFrontFile!.Length > maxFileSizeBytes)
                return BadRequest(new { message = "Ảnh CCCD mặt trước không quá 5MB." });
            if (cccdBackFile!.Length > maxFileSizeBytes)
                return BadRequest(new { message = "Ảnh CCCD mặt sau không quá 5MB." });
        }

        var retainedIds = new List<Guid>();
        if (!string.IsNullOrWhiteSpace(form.RetainedLicenseIds))
        {
            foreach (var idStr in form.RetainedLicenseIds.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                if (Guid.TryParse(idStr.Trim(), out var guid)) retainedIds.Add(guid);
            }
        }

        var hasLicenseEffectiveUpdate = hasLicenseUpload || hasLicenseRetainStr;

        if (hasLicenseEffectiveUpdate)
        {
            if (retainedIds.Count + licenseFiles.Count > 3)
                return BadRequest(new { message = "Tổng số giấy phép (giữ lại + mới) không được quá 3 file." });

            foreach (var f in licenseFiles)
            {
                if (!IsLicenseFile(f))
                    return BadRequest(new { message = "Giấy phép kinh doanh chấp nhận JPG, PNG hoặc PDF." });
                if (f.Length > maxFileSizeBytes)
                    return BadRequest(new { message = "Mỗi file giấy phép kinh doanh không quá 5MB." });
            }
        }

        if (isRegistration)
        {
            var hasCccdFrontEffective = hasCccdFront || pending?.CccdFrontFileId != null;
            var hasCccdBackEffective = hasCccdBack || pending?.CccdBackFileId != null;
            var hasLicenseEffective =
                hasLicenseEffectiveUpdate ? (retainedIds.Count + licenseFiles.Count > 0) :
                (pending?.BusinessLicenseFileId1 != null ||
                 pending?.BusinessLicenseFileId2 != null ||
                 pending?.BusinessLicenseFileId3 != null);

            var hasTaxEffective = hasTaxCode || !string.IsNullOrWhiteSpace(pending?.TaxCode);
            var hasAddressEffective = hasAddress || !string.IsNullOrWhiteSpace(pending?.Address);

            if (!hasCccdFrontEffective || !hasCccdBackEffective)
                return BadRequest(new { message = "Thiếu ảnh CCCD (cần đủ 2 mặt)." });
            if (!hasLicenseEffective)
                return BadRequest(new { message = "Vui lòng tải lên giấy phép kinh doanh (tối đa 3 file)." });
            if (!hasTaxEffective)
                return BadRequest(new { message = "Vui lòng nhập mã số thuế." });
            if (!hasAddressEffective)
                return BadRequest(new { message = "Vui lòng nhập địa chỉ." });
        }

        // Get or create pending request (policy: chỉ giữ 1 request PENDING)
        if (pending == null)
        {
            pending = new ManagerProfileRequest
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RequestType = requestType,
                Status = "PENDING",
                RequestedAt = DateTime.UtcNow
            };
            await _requestRepo.AddAsync(pending);
        }

        // Upload files -> create File rows
        try
        {
            // Chỉ ghi đè nếu FE gửi field có giá trị
            if (hasTaxCode) pending.TaxCode = taxCode!.Trim();
            if (hasAddress) pending.Address = address!.Trim();

            if (hasCccdFront && hasCccdBack)
            {
                pending.CccdFrontFileId = await UploadFileAsync(cccdFrontFile!, "manager/cccd", "cccd_front");
                pending.CccdBackFileId = await UploadFileAsync(cccdBackFile!, "manager/cccd", "cccd_back");
            }

            if (hasLicenseEffectiveUpdate)
            {
                var finalIds = new List<Guid>();
                finalIds.AddRange(retainedIds);

                foreach (var f in licenseFiles)
                {
                    var newId = await UploadFileAsync(f, "manager/license", $"license_{Guid.NewGuid().ToString().Substring(0, 5)}");
                    finalIds.Add(newId);
                }

                pending.BusinessLicenseFileId1 = finalIds.Count >= 1 ? finalIds[0] : null;
                pending.BusinessLicenseFileId2 = finalIds.Count >= 2 ? finalIds[1] : null;
                pending.BusinessLicenseFileId3 = finalIds.Count >= 3 ? finalIds[2] : null;
            }

            // reset decision fields khi gửi lại
            pending.AdminUserId = null;
            pending.DecisionAt = null;
            pending.DecisionNote = null;
            pending.RequestType = requestType;
            pending.RequestedAt = DateTime.UtcNow;

            await _requestRepo.UpdateAsync(pending);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        // ── Notify tất cả Admin có hồ sơ mới chờ duyệt ──
        try
        {
            var adminIds = await _db.Users
                .AsNoTracking()
                .Where(u => u.Roles.Any(r => r.Name == "ADMIN") && u.IsActive == true)
                .Select(u => u.Id)
                .ToListAsync();

            var userName = user.FullName ?? "Người dùng";
            var reqLabel = requestType == "CAP_NHAT" ? "cập nhật" : "đăng ký";

            foreach (var adminId in adminIds)
            {
                await _notify.NotifyUserAsync(
                    adminId,
                    NotificationTypes.ManagerRequestSubmitted,
                    $"Có hồ sơ {reqLabel} Chủ sân mới!",
                    $"{userName} vừa gửi hồ sơ {reqLabel} Chủ sân. Bấm để xem chi tiết.",
                    metadata: new { deepLink = "/admin/manager-requests" });
            }
        }
        catch { /* không block response nếu notify fail */ }

        return Ok(new
        {
            message = "Đã gửi/cập nhật hồ sơ quản lý. Vui lòng chờ Admin duyệt.",
            status = "PENDING",
            requestType
        });
    }

    public class UpdateMyProfileUploadDto
    {
        public string? TaxCode { get; set; }
        public string? Address { get; set; }

        public IFormFile? CccdFrontFile { get; set; }
        public IFormFile? CccdBackFile { get; set; }

        public string? RetainedLicenseIds { get; set; }

        // FE gửi: businessLicenseFiles (multiple)
        public List<IFormFile>? BusinessLicenseFiles { get; set; }
    }
}


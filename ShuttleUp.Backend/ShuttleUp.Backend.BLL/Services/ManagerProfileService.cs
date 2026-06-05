using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.BLL.Services;

public class ManagerProfileService : IManagerProfileService
{
    private readonly IManagerProfileRepository _repo;
    private readonly IManagerProfileRequestRepository _requestRepo;
    private readonly IUserRepository _users;
    private readonly IFileRepository _fileRepo;
    private readonly Cloudinary _cloudinary;

    public ManagerProfileService(IManagerProfileRepository repo, IManagerProfileRequestRepository requestRepo, IUserRepository users, IFileRepository fileRepo, Cloudinary cloudinary)
    {
        _repo = repo; _requestRepo = requestRepo; _users = users; _fileRepo = fileRepo; _cloudinary = cloudinary;
    }

    public async Task<object?> GetProfileAsync(Guid userId)
    {
        var latestRequest = await _requestRepo.GetLatestByUserIdAsync(userId);
        var snapshot = await _repo.GetByUserIdAsync(userId);
        if (latestRequest == null && snapshot == null) return new { status = (string?)null };

        var status = latestRequest?.Status ?? snapshot?.Status;
        var effectiveRequestType = latestRequest?.RequestType ?? (snapshot?.Status == "APPROVED" ? "CAP_NHAT" : "DANG_KY");

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

        var files = await _fileRepo.GetByIdsAsync(fileIds);
        var fileDict = files.ToDictionary(f => f.Id, f => f);
        DalFile? GetFile(Guid? id) => id != null && fileDict.TryGetValue(id.Value, out var f) ? f : null;

        var cccdFront = GetFile(cccdFrontId); var cccdBack = GetFile(cccdBackId);
        var bl1 = GetFile(bl1Id); var bl2 = GetFile(bl2Id); var bl3 = GetFile(bl3Id);
        var taxCode = latestRequest?.TaxCode ?? snapshot?.TaxCode;
        var address = latestRequest?.Address ?? snapshot?.Address;
        var businessLicenseFiles = new[] { bl1, bl2, bl3 }.Where(x => x != null).Select(x => new { id = x!.Id, url = x.FileUrl, mimeType = x.MimeType }).ToList();

        return new
        {
            userId, status, requestType = effectiveRequestType, taxCode, address,
            cccdFrontUrl = cccdFront?.FileUrl, cccdBackUrl = cccdBack?.FileUrl, businessLicenseFiles,
            decisionAt = latestRequest?.DecisionAt, decisionNote = latestRequest?.DecisionNote
        };
    }

    public async Task<object> UpdateProfileAsync(Guid userId, ManagerProfileUpdateParams p)
    {
        var user = await _users.GetByIdAsync(userId) ?? throw new UnauthorizedAccessException("Không tìm thấy người dùng.");
        var snapshot = await _repo.GetByUserIdAsync(userId);
        var isApproved = string.Equals(snapshot?.Status, "APPROVED", StringComparison.OrdinalIgnoreCase);
        var requestType = isApproved ? "CAP_NHAT" : "DANG_KY";
        var isRegistration = requestType == "DANG_KY";
        
        var pending = await _requestRepo.GetPendingByUserIdAsync(userId);
        var latestRequest = await _requestRepo.GetLatestByUserIdAsync(userId);
        bool isNewPending = false;

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
            if (latestRequest != null)
            {
                pending.TaxCode = latestRequest.TaxCode;
                pending.Address = latestRequest.Address;
                pending.CccdFrontFileId = latestRequest.CccdFrontFileId;
                pending.CccdBackFileId = latestRequest.CccdBackFileId;
                pending.BusinessLicenseFileId1 = latestRequest.BusinessLicenseFileId1;
                pending.BusinessLicenseFileId2 = latestRequest.BusinessLicenseFileId2;
                pending.BusinessLicenseFileId3 = latestRequest.BusinessLicenseFileId3;
            }
            isNewPending = true;
        }

        var licenseFiles = (p.BusinessLicenseFiles ?? new List<FileUploadParam>()).Where(f => f.Length > 0).ToList();
        var hasTaxCode = !string.IsNullOrWhiteSpace(p.TaxCode);
        var hasAddress = !string.IsNullOrWhiteSpace(p.Address);
        var hasCccdFront = p.CccdFrontFile != null && p.CccdFrontFile.Length > 0;
        var hasCccdBack = p.CccdBackFile != null && p.CccdBackFile.Length > 0;
        var hasLicenseUpload = licenseFiles.Count > 0;
        var hasLicenseRetainStr = p.RetainedLicenseIds != null;
        var hasAnyUpdate = hasTaxCode || hasAddress || hasCccdFront || hasCccdBack || hasLicenseUpload || hasLicenseRetainStr;
        
        if (!hasAnyUpdate && !isNewPending) throw new InvalidOperationException("Bạn chưa cập nhật thông tin nào.");

        const long maxFileSizeBytes = 5 * 1024 * 1024;
        bool IsImage(string? ct) => !string.IsNullOrWhiteSpace(ct) && (ct.StartsWith("image/jpeg", StringComparison.OrdinalIgnoreCase) || ct.StartsWith("image/png", StringComparison.OrdinalIgnoreCase));
        bool IsLicenseFile(FileUploadParam f) => f.ContentType != null && (f.ContentType.StartsWith("application/pdf", StringComparison.OrdinalIgnoreCase) || IsImage(f.ContentType));

        if (hasCccdFront || hasCccdBack)
        {
            if (!hasCccdFront || !hasCccdBack) throw new InvalidOperationException("Nếu upload CCCD thì cần đủ 2 mặt.");
            if (!IsImage(p.CccdFrontFile!.ContentType)) throw new InvalidOperationException("CCCD mặt trước phải là JPG hoặc PNG.");
            if (!IsImage(p.CccdBackFile!.ContentType)) throw new InvalidOperationException("CCCD mặt sau phải là JPG hoặc PNG.");
            if (p.CccdFrontFile!.Length > maxFileSizeBytes) throw new InvalidOperationException("Ảnh CCCD mặt trước không quá 5MB.");
            if (p.CccdBackFile!.Length > maxFileSizeBytes) throw new InvalidOperationException("Ảnh CCCD mặt sau không quá 5MB.");
        }

        var retainedIds = new List<Guid>();
        if (!string.IsNullOrWhiteSpace(p.RetainedLicenseIds))
            foreach (var idStr in p.RetainedLicenseIds.Split(',', StringSplitOptions.RemoveEmptyEntries))
                if (Guid.TryParse(idStr.Trim(), out var guid)) retainedIds.Add(guid);

        var hasLicenseEffectiveUpdate = hasLicenseUpload || hasLicenseRetainStr;
        if (hasLicenseEffectiveUpdate)
        {
            if (retainedIds.Count + licenseFiles.Count > 3) throw new InvalidOperationException("Tổng số giấy phép không quá 3 file.");
            foreach (var f in licenseFiles)
            {
                if (!IsLicenseFile(f)) throw new InvalidOperationException("Giấy phép chấp nhận JPG, PNG hoặc PDF.");
                if (f.Length > maxFileSizeBytes) throw new InvalidOperationException("Mỗi file giấy phép không quá 5MB.");
            }
        }

        if (isRegistration)
        {
            var hasCccdFrontEff = hasCccdFront || pending.CccdFrontFileId != null;
            var hasCccdBackEff = hasCccdBack || pending.CccdBackFileId != null;
            var hasLicenseEff = hasLicenseEffectiveUpdate ? (retainedIds.Count + licenseFiles.Count > 0) : (pending.BusinessLicenseFileId1 != null || pending.BusinessLicenseFileId2 != null || pending.BusinessLicenseFileId3 != null);
            var hasTaxEff = hasTaxCode || !string.IsNullOrWhiteSpace(pending.TaxCode);
            var hasAddressEff = hasAddress || !string.IsNullOrWhiteSpace(pending.Address);
            if (!hasCccdFrontEff || !hasCccdBackEff) throw new InvalidOperationException("Thiếu ảnh CCCD (cần đủ 2 mặt).");
            if (!hasLicenseEff) throw new InvalidOperationException("Vui lòng tải lên giấy phép kinh doanh.");
            if (!hasTaxEff) throw new InvalidOperationException("Vui lòng nhập mã số thuế.");
            if (!hasAddressEff) throw new InvalidOperationException("Vui lòng nhập địa chỉ.");
        }

        if (isNewPending)
        {
            await _requestRepo.AddAsync(pending);
        }

        if (hasTaxCode) pending.TaxCode = p.TaxCode!.Trim();
        if (hasAddress) pending.Address = p.Address!.Trim();

        if (hasCccdFront && hasCccdBack)
        {
            pending.CccdFrontFileId = await UploadFileAsync(p.CccdFrontFile!, "manager/cccd", "cccd_front", userId);
            pending.CccdBackFileId = await UploadFileAsync(p.CccdBackFile!, "manager/cccd", "cccd_back", userId);
        }

        if (hasLicenseEffectiveUpdate)
        {
            var finalIds = new List<Guid>(retainedIds);
            foreach (var f in licenseFiles)
            {
                var newId = await UploadFileAsync(f, "manager/license", $"license_{Guid.NewGuid().ToString().Substring(0, 5)}", userId);
                finalIds.Add(newId);
            }
            pending.BusinessLicenseFileId1 = finalIds.Count >= 1 ? finalIds[0] : null;
            pending.BusinessLicenseFileId2 = finalIds.Count >= 2 ? finalIds[1] : null;
            pending.BusinessLicenseFileId3 = finalIds.Count >= 3 ? finalIds[2] : null;
        }

        pending.AdminUserId = null; pending.DecisionAt = null; pending.DecisionNote = null;
        pending.RequestType = requestType; pending.RequestedAt = DateTime.UtcNow;
        await _requestRepo.UpdateAsync(pending);

        return new { message = "Đã gửi/cập nhật hồ sơ quản lý. Vui lòng chờ Admin duyệt.", status = "PENDING", requestType, userName = user.FullName ?? "Người dùng" };
    }

    private async Task<Guid> UploadFileAsync(FileUploadParam file, string folder, string publicIdBase, Guid userId)
    {
        var fileId = Guid.NewGuid();
        var publicId = $"{publicIdBase}_{fileId}";

        dynamic result;
        if (file.ContentType != null && file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            var p = new ImageUploadParams { File = new FileDescription(file.FileName, file.Stream), Folder = folder, PublicId = publicId, Overwrite = true, Invalidate = true };
            result = await _cloudinary.UploadAsync(p);
        }
        else
        {
            var p = new RawUploadParams { File = new FileDescription(file.FileName, file.Stream), Folder = folder, PublicId = publicId, Overwrite = true, Invalidate = true };
            result = await _cloudinary.UploadAsync(p);
        }

        var secureUrl = result?.SecureUrl?.ToString();
        if (string.IsNullOrWhiteSpace(secureUrl)) throw new InvalidOperationException("Cloudinary upload failed.");

        await _fileRepo.AddFileAsync(new DalFile { Id = fileId, FileUrl = secureUrl, FileName = publicId, MimeType = file.ContentType, FileSize = (int?)file.Length, UploadedByUserId = userId, CreatedAt = DateTime.UtcNow });
        return fileId;
    }
}

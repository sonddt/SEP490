using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.DTOs.Profile;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.BLL.Services;

public class ProfileService : IProfileService
{
    private readonly IUserRepository _userRepo;
    private readonly IManagerProfileRepository _managerProfileRepo;
    private readonly IFileRepository _fileRepo;
    private readonly ISocialRepository _socialRepo;
    private readonly IFileService _fileService;
    private readonly ShuttleUpDbContext _db;

    public ProfileService(
        IUserRepository userRepo,
        IManagerProfileRepository managerProfileRepo,
        IFileRepository fileRepo,
        ISocialRepository socialRepo,
        IFileService fileService,
        ShuttleUpDbContext db)
    {
        _userRepo = userRepo;
        _managerProfileRepo = managerProfileRepo;
        _fileRepo = fileRepo;
        _socialRepo = socialRepo;
        _fileService = fileService;
        _db = db;
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

    public async Task<MyProfileDetailsDto?> GetMyProfileAsync(Guid userId)
    {
        User? user;
        try
        {
            user = await _userRepo.GetProfileWithDetailsAsync(userId);
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
            // Fallback cho DB cũ
            user = await _db.Users.AsNoTracking().Include(u => u.Roles).Include(u => u.AvatarFile)
                .Select(u => new User
                {
                    Id = u.Id,
                    Email = u.Email,
                    FullName = u.FullName,
                    PhoneNumber = u.PhoneNumber,
                    Gender = u.Gender,
                    DateOfBirth = u.DateOfBirth,
                    AvatarFile = u.AvatarFile,
                    CreatedAt = u.CreatedAt,
                    Roles = u.Roles
                })
                .FirstOrDefaultAsync(u => u.Id == userId);
        }

        if (user == null) return null;

        var managerProfile = await _managerProfileRepo.GetByUserIdAsync(userId);

        var fileIds = new List<Guid>();
        if (managerProfile?.CccdFrontFileId != null) fileIds.Add(managerProfile.CccdFrontFileId.Value);
        if (managerProfile?.CccdBackFileId != null) fileIds.Add(managerProfile.CccdBackFileId.Value);
        if (managerProfile?.BusinessLicenseFileId1 != null) fileIds.Add(managerProfile.BusinessLicenseFileId1.Value);
        if (managerProfile?.BusinessLicenseFileId2 != null) fileIds.Add(managerProfile.BusinessLicenseFileId2.Value);
        if (managerProfile?.BusinessLicenseFileId3 != null) fileIds.Add(managerProfile.BusinessLicenseFileId3.Value);

        var files = fileIds.Count == 0 ? new List<DalFile>() : await _fileRepo.GetByIdsAsync(fileIds);
        var fileDict = files.ToDictionary(f => f.Id, f => f);

        DalFile? GetFile(Guid? id) => id != null && fileDict.TryGetValue(id.Value, out var f) ? f : null;

        var cccdFront = GetFile(managerProfile?.CccdFrontFileId);
        var cccdBack = GetFile(managerProfile?.CccdBackFileId);
        var bl1 = GetFile(managerProfile?.BusinessLicenseFileId1);
        var bl2 = GetFile(managerProfile?.BusinessLicenseFileId2);
        var bl3 = GetFile(managerProfile?.BusinessLicenseFileId3);

        var businessLicenseFiles = new[] { bl1, bl2, bl3 }
            .Where(x => x != null)
            .Select(x => new ManagerDocumentDto { Id = x!.Id, Url = x.FileUrl, MimeType = x.MimeType })
            .ToList();

        var userProfileDto = new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            About = user.About,
            PhoneNumber = user.PhoneNumber,
            Address = user.Address,
            District = user.District,
            Province = user.Province,
            Gender = user.Gender,
            DateOfBirth = user.DateOfBirth?.ToString("yyyy-MM-dd"),
            SkillLevel = user.SkillLevel,
            PlayPurpose = user.PlayPurpose,
            PlayFrequency = user.PlayFrequency,
            IsPersonalized = user.IsPersonalized,
            AvatarUrl = user.AvatarFile?.FileUrl,
            CreatedAt = user.CreatedAt
        };

        var managerProfileDto = managerProfile == null ? null : new ManagerProfilePublicDto
        {
            UserId = managerProfile.UserId,
            TaxCode = managerProfile.TaxCode,
            Address = managerProfile.Address,
            Status = managerProfile.Status,
            DecisionAt = managerProfile.DecisionAt,
            DecisionNote = managerProfile.DecisionNote,
            CccdFrontUrl = cccdFront?.FileUrl,
            CccdBackUrl = cccdBack?.FileUrl,
            BusinessLicenseFiles = businessLicenseFiles
        };

        return new MyProfileDetailsDto
        {
            User = userProfileDto,
            Roles = user.Roles.Select(r => r.Name).ToList(),
            ManagerProfile = managerProfileDto
        };
    }

    public async Task<PublicProfileDto?> GetPublicProfileAsync(Guid targetUserId, Guid viewerId)
    {
        var target = await _userRepo.GetProfileWithDetailsAsync(targetUserId);
        if (target == null || target.IsActive == false)
            return null;

        string relationshipState = "NONE";
        Guid? pendingRequestId = null;

        if (await _socialRepo.IsBlockedByMeAsync(viewerId, targetUserId))
        {
            relationshipState = "BLOCKED_BY_ME";
        }
        else if (await _socialRepo.IsBlockedByThemAsync(viewerId, targetUserId))
        {
            relationshipState = "BLOCKED_BY_THEM";
        }
        else
        {
            // userLowId < userHighId mapping for FriendshipExistsAsync
            var lowId = string.Compare(viewerId.ToString("D"), targetUserId.ToString("D"), StringComparison.Ordinal) < 0 ? viewerId : targetUserId;
            var highId = lowId == viewerId ? targetUserId : viewerId;

            if (await _socialRepo.FriendshipExistsAsync(lowId, highId))
            {
                relationshipState = "FRIENDS";
            }
            else
            {
                var pendingReqs = (await _socialRepo.GetPendingRequestsBetweenAsync(viewerId, targetUserId)).ToList();
                var outgoing = pendingReqs.FirstOrDefault(r => r.FromUserId == viewerId);
                var incoming = pendingReqs.FirstOrDefault(r => r.FromUserId == targetUserId);

                if (outgoing != null)
                {
                    relationshipState = "PENDING_OUT";
                }
                else if (incoming != null)
                {
                    relationshipState = "PENDING_IN";
                    pendingRequestId = incoming.Id;
                }
            }
        }

        var userProfileDto = new UserProfileDto
        {
            Id = target.Id,
            FullName = target.FullName,
            SkillLevel = target.SkillLevel,
            PlayPurpose = target.PlayPurpose,
            PlayFrequency = target.PlayFrequency,
            AvatarUrl = target.AvatarFile?.FileUrl
        };

        return new PublicProfileDto
        {
            User = userProfileDto,
            RelationshipState = relationshipState,
            PendingRequestId = pendingRequestId
        };
    }

    public async Task<object> UpdateMyProfileAsync(Guid userId, UpdateProfileDto dto)
    {
        var fullName = (dto.FullName ?? string.Empty).Trim();
        var phone = string.IsNullOrWhiteSpace(dto.PhoneNumber) ? null : dto.PhoneNumber.Trim();

        try
        {
            if (!string.IsNullOrWhiteSpace(phone))
            {
                var phoneInUse = await _db.Users.AnyAsync(u => u.Id != userId && u.PhoneNumber != null && u.PhoneNumber == phone);
                if (phoneInUse) throw new InvalidOperationException("Số điện thoại đã được sử dụng.");
            }
        }
        catch (Exception ex) when (IsUnknownColumnException(ex)) { }

        DateOnly? parsedDob = null;
        if (!string.IsNullOrWhiteSpace(dto.DateOfBirth))
        {
            if (!DateOnly.TryParse(dto.DateOfBirth.Trim(), out var dob))
                throw new ArgumentException("Ngày sinh không hợp lệ (dùng định dạng yyyy-MM-dd).");
            parsedDob = dob;
        }

        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null) throw new KeyNotFoundException("Không tìm thấy tài khoản.");

        user.FullName = fullName;
        user.PhoneNumber = phone;
        user.Gender = string.IsNullOrWhiteSpace(dto.Gender) ? null : dto.Gender.Trim();
        user.DateOfBirth = parsedDob;

        try
        {
            await _userRepo.SaveChangesAsync();
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($"UPDATE users SET full_name = {fullName}, phone_number = {phone} WHERE id = {userId}");
            return new { message = "Cập nhật họ tên và số điện thoại thành công. (Một số cột khác trên DB có thể chưa đồng bộ)" };
        }

        try
        {
            user.About = string.IsNullOrWhiteSpace(dto.About) ? null : dto.About.Trim();
            user.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
            user.District = string.IsNullOrWhiteSpace(dto.District) ? null : dto.District.Trim();
            user.Province = string.IsNullOrWhiteSpace(dto.Province) ? null : dto.Province.Trim();

            if (dto.SkillLevel != null) user.SkillLevel = dto.SkillLevel.Trim();
            if (dto.PlayPurpose != null) user.PlayPurpose = dto.PlayPurpose.Trim();
            if (dto.PlayFrequency != null) user.PlayFrequency = dto.PlayFrequency.Trim();
            if (dto.IsPersonalized.HasValue) user.IsPersonalized = dto.IsPersonalized.Value;

            await _userRepo.SaveChangesAsync();
        }
        catch (Exception ex) when (IsUnknownColumnException(ex))
        {
            return new { message = "Cập nhật hồ sơ thành công (một số trường phụ có thể chưa cập nhật do DB thiếu cột)." };
        }

        return new { message = "Cập nhật hồ sơ thành công." };
    }

    public async Task<string> UploadAvatarAsync(Guid userId, IFormFile avatar, CancellationToken cancellationToken = default)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null) throw new KeyNotFoundException();

        var upload = await _fileService.UploadAvatarAsync(avatar, userId, cancellationToken);
        var secureUrl = upload.SecureUrl;

        if (user.AvatarFileId == null)
        {
            var file = new DalFile
            {
                Id = Guid.NewGuid(),
                FileUrl = secureUrl,
                FileName = $"avatar_{userId}",
                MimeType = avatar.ContentType,
                FileSize = (int?)avatar.Length,
                UploadedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            await _fileRepo.AddFileAsync(file);
            user.AvatarFileId = file.Id;
            await _userRepo.SaveChangesAsync();
        }
        else
        {
            var existingFile = (await _fileRepo.GetByIdsAsync(new List<Guid> { user.AvatarFileId.Value })).FirstOrDefault();
            if (existingFile != null && existingFile.FileUrl != secureUrl)
            {
                existingFile.FileUrl = secureUrl;
                await _fileRepo.SaveChangesAsync();
            }
        }

        return secureUrl;
    }
}

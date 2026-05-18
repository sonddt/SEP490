using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Profile;

public class UserProfileDto
{
    public Guid Id { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? About { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string? District { get; set; }
    public string? Province { get; set; }
    public string? Gender { get; set; }
    public string? DateOfBirth { get; set; }
    public string? SkillLevel { get; set; }
    public string? PlayPurpose { get; set; }
    public string? PlayFrequency { get; set; }
    public bool? IsPersonalized { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class ManagerProfilePublicDto
{
    public Guid UserId { get; set; }
    public string? TaxCode { get; set; }
    public string? Address { get; set; }
    public string? Status { get; set; }
    public DateTime? DecisionAt { get; set; }
    public string? DecisionNote { get; set; }
    public string? CccdFrontUrl { get; set; }
    public string? CccdBackUrl { get; set; }
    public List<ManagerDocumentDto> BusinessLicenseFiles { get; set; } = new();
}

public class ManagerDocumentDto
{
    public Guid Id { get; set; }
    public string? Url { get; set; }
    public string? MimeType { get; set; }
}

public class MyProfileDetailsDto
{
    public UserProfileDto User { get; set; } = null!;
    public IEnumerable<string> Roles { get; set; } = new List<string>();
    public ManagerProfilePublicDto? ManagerProfile { get; set; }
}

public class PublicProfileDto
{
    public UserProfileDto User { get; set; } = null!;
    public string RelationshipState { get; set; } = "NONE";
    public Guid? PendingRequestId { get; set; }
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

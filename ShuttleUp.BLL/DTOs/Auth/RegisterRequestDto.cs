using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Auth;

public class RegisterRequestDto : IValidatableObject
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = null!;

    [Required]
    public string FullName { get; set; } = null!;

    public string? PhoneNumber { get; set; }

    public string? Gender { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public bool IsManagerRoleRequested { get; set; }

    public string? IdCardNo { get; set; }

    public string? TaxCode { get; set; }

    public string? BusinessLicenseNo { get; set; }

    public string? Address { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (IsManagerRoleRequested)
        {
            if (string.IsNullOrWhiteSpace(IdCardNo))
                yield return new ValidationResult("CCCD/CMND là bắt buộc đối với Chủ sân.", [nameof(IdCardNo)]);
            
            if (string.IsNullOrWhiteSpace(TaxCode))
                yield return new ValidationResult("Mã số thuế là bắt buộc đối với Chủ sân.", [nameof(TaxCode)]);
            
            if (string.IsNullOrWhiteSpace(BusinessLicenseNo))
                yield return new ValidationResult("Giấy phép kinh doanh là bắt buộc đối với Chủ sân.", [nameof(BusinessLicenseNo)]);
            
            if (string.IsNullOrWhiteSpace(Address))
                yield return new ValidationResult("Địa chỉ là bắt buộc đối với Chủ sân.", [nameof(Address)]);
        }
    }
}

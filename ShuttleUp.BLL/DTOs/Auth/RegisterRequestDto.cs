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
        // Không bắt buộc các thông tin pháp lý tại bước đăng ký.
        // Người dùng sẽ hoàn thiện trong trang hồ sơ Quản lý và chờ Admin duyệt.
        yield break;
    }
}

using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace ShuttleUp.BLL.DTOs.Auth;

public class RegisterRequestDto : IValidatableObject
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    [MinLength(8)]
    [MaxLength(32)]
    public string Password { get; set; } = null!;

    [Required]
    [RegularExpression(@"^[a-zA-ZÀ-ỹ\u0110\u0111\s]{2,50}$", ErrorMessage = "Họ và tên không hợp lệ (không chứa số, ký tự đặc biệt) và phải từ 2-50 ký tự.")]
    public string FullName { get; set; } = null!;

    [Required]
    [RegularExpression(@"^(0|84)(3|5|7|8|9)[0-9]{8}$", ErrorMessage = "Số điện thoại không đúng định dạng Việt Nam (bắt đầu bằng 0 hoặc 84, gồm 10 chữ số).")]
    public string PhoneNumber { get; set; } = null!;

    public string? Gender { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public bool IsManagerRoleRequested { get; set; }

    public string? IdCardNo { get; set; }

    public string? TaxCode { get; set; }

    public string? BusinessLicenseNo { get; set; }

    public string? Address { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // 1) Universal email format requirement
        if (!string.IsNullOrWhiteSpace(Email))
        {
            var universalEmailRegex = new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase);
            if (!universalEmailRegex.IsMatch(Email))
                yield return new ValidationResult(
                    "Email không đúng định dạng chuẩn (ví dụ: yourname@domain.com).",
                    new[] { nameof(Email) }
                );
        }

        // 2) Password complexity: length 8-32 (bắt buộc) + (Upper, Lower, Number, Special) => pass at least 3/4
        if (!string.IsNullOrWhiteSpace(Password))
        {
            var lengthOk = Password.Length >= 8 && Password.Length <= 32;
            var hasUpper = Regex.IsMatch(Password, "[A-Z]");
            var hasLower = Regex.IsMatch(Password, "[a-z]");
            var hasNumber = Regex.IsMatch(Password, "\\d");
            var hasSpecial = Regex.IsMatch(Password, @"[^a-zA-Z0-9]");

            var otherPassed =
                (hasUpper ? 1 : 0) +
                (hasLower ? 1 : 0) +
                (hasNumber ? 1 : 0) +
                (hasSpecial ? 1 : 0);

            if (!lengthOk || otherPassed < 3)
                yield return new ValidationResult(
                    "Mật khẩu phải dài 8-32 ký tự và thỏa ít nhất 3/4 điều kiện còn lại (hoa, thường, số, ký tự đặc biệt).",
                    new[] { nameof(Password) }
                );
        }
    }
}

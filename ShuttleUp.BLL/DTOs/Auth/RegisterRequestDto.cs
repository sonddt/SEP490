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
    public string FullName { get; set; } = null!;

    [Required]
    [RegularExpression(@"^\d{9,11}$", ErrorMessage = "Số điện thoại phải gồm 9-11 chữ số.")]
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
        // 1) Gmail requirement
        if (!string.IsNullOrWhiteSpace(Email))
        {
            var gmailRegex = new Regex(@"^[A-Za-z0-9._%+\-]+@gmail\.com$", RegexOptions.IgnoreCase);
            if (!gmailRegex.IsMatch(Email))
                yield return new ValidationResult(
                    "Email phải đúng định dạng Gmail (ví dụ: yourname@gmail.com).",
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
            var hasSpecial = Regex.IsMatch(Password, @"[!@#$%^&*()_+\-\.]");

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

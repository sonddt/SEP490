using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Auth;

public class LoginRequestDto : IValidatableObject
{
    [EmailAddress]
    public string? Email { get; set; }

    [Phone]
    public string? PhoneNumber { get; set; }

    [Required]
    public string Password { get; set; } = null!;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Email) && string.IsNullOrWhiteSpace(PhoneNumber))
        {
            yield return new ValidationResult(
                "Vui lòng nhập Email hoặc Số điện thoại.",
                new[] { nameof(Email), nameof(PhoneNumber) });
        }
    }
}

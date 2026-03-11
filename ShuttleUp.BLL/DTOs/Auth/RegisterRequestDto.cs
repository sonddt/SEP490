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

    /// <summary>
    /// Chọn 1 hoặc cả 2: ["PLAYER"] | ["MANAGER"] | ["PLAYER","MANAGER"]
    /// Không được chọn ADMIN — chỉ admin khác mới có quyền gán role ADMIN.
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 role.")]
    public List<string> Roles { get; set; } = ["Player"];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Player", "Manager" };
        foreach (var role in Roles)
        {
            if (!allowed.Contains(role))
                yield return new ValidationResult(
                    $"Role '{role}' không hợp lệ. Chỉ được chọn Player hoặc Manager.",
                    [nameof(Roles)]);
        }
    }
}

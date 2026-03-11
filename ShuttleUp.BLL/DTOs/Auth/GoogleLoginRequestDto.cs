using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Auth;

public class GoogleLoginRequestDto : IValidatableObject
{
    /// <summary>ID token nhận được từ Google Sign-In trên frontend</summary>
    [Required]
    public string IdToken { get; set; } = null!;

    /// <summary>
    /// Chỉ cần khi đăng ký lần đầu qua Google.
    /// Nếu user đã tồn tại thì bỏ qua trường này.
    /// Hợp lệ: ["PLAYER"] | ["MANAGER"] | ["PLAYER","MANAGER"]
    /// </summary>
    public List<string> Roles { get; set; } = ["PLAYER"];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "PLAYER", "MANAGER" };
        foreach (var role in Roles)
        {
            if (!allowed.Contains(role))
                yield return new ValidationResult(
                    $"Role '{role}' không hợp lệ. Chỉ được chọn PLAYER hoặc MANAGER.",
                    [nameof(Roles)]);
        }
    }
}

using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class ChangePasswordRequestDtoTests
{
    private static ChangePasswordRequestDto CreateValidDto() => new()
    {
        CurrentPassword = "OldPass123!",
        NewPassword = "NewPass123!",
        ConfirmPassword = "NewPass123!"
    };

    [Fact]
    public void Validate_ShouldPass_WithValidData()
    {
        var dto = CreateValidDto();

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenCurrentPasswordMissing(string? currentPassword)
    {
        var dto = CreateValidDto();
        dto.CurrentPassword = currentPassword!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(ChangePasswordRequestDto.CurrentPassword)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    public void Validate_ShouldFail_WhenNewPasswordInvalid(string? newPassword)
    {
        var dto = CreateValidDto();
        dto.NewPassword = newPassword!;
        dto.ConfirmPassword = newPassword!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(ChangePasswordRequestDto.NewPassword)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("Mismatch123!")]
    public void Validate_ShouldFail_WhenConfirmPasswordInvalidOrNotMatch(string? confirmPassword)
    {
        var dto = CreateValidDto();
        dto.ConfirmPassword = confirmPassword!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.True(
            results.Any(r => r.MemberNames.Contains(nameof(ChangePasswordRequestDto.ConfirmPassword)))
            || results.Any(r => r.ErrorMessage == "Mật khẩu xác nhận không khớp."));
    }
}

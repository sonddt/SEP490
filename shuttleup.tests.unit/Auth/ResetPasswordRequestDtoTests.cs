using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class ResetPasswordRequestDtoTests
{
    private static ResetPasswordRequestDto CreateValidDto() => new()
    {
        Token = "sample-token",
        NewPassword = "Valid123",
        ConfirmPassword = "Valid123"
    };

    [Fact]
    public void Validate_ShouldPass_WhenConfirmPasswordMatches()
    {
        var dto = CreateValidDto();

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenTokenMissing(string? token)
    {
        var dto = CreateValidDto();
        dto.Token = token!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(ResetPasswordRequestDto.Token)));
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

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(ResetPasswordRequestDto.NewPassword)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("Valid1234")]
    public void Validate_ShouldFail_WhenConfirmPasswordInvalidOrNotMatch(string? confirmPassword)
    {
        var dto = CreateValidDto();
        dto.ConfirmPassword = confirmPassword!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.True(
            results.Any(r => r.MemberNames.Contains(nameof(ResetPasswordRequestDto.ConfirmPassword)))
            || results.Any(r => r.ErrorMessage == "Mật khẩu xác nhận không khớp."));
    }
}

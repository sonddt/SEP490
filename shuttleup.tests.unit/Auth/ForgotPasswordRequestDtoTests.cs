using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class ForgotPasswordRequestDtoTests
{
    [Theory]
    [InlineData("player@gmail.com")]
    [InlineData("PLAYER@GMAIL.COM")]
    public void Validate_ShouldPass_WhenEmailIsValid(string email)
    {
        var dto = new ForgotPasswordRequestDto
        {
            Email = email
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("invalid-email")]
    [InlineData("playergmail.com")]
    public void Validate_ShouldFail_WhenEmailIsMissingOrInvalid(string? email)
    {
        var dto = new ForgotPasswordRequestDto
        {
            Email = email!
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(ForgotPasswordRequestDto.Email)));
    }
}

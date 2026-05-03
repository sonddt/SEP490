using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class LoginRequestDtoTests
{
    [Theory]
    [InlineData(null, null)]
    public void Validate_ShouldFail_WhenEmailAndPhoneAreBothEmpty(string? email, string? phoneNumber)
    {
        var dto = new LoginRequestDto
        {
            Email = email,
            PhoneNumber = phoneNumber,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.ErrorMessage == "Vui lòng nhập Email hoặc Số điện thoại.");
    }

    [Theory]
    [InlineData("", "")]
    [InlineData("   ", "   ")]
    public void Validate_ShouldFail_WhenEmailAndPhoneAreBlankStrings(string email, string phoneNumber)
    {
        var dto = new LoginRequestDto
        {
            Email = email,
            PhoneNumber = phoneNumber,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.True(
            results.Any(r => r.MemberNames.Contains(nameof(LoginRequestDto.Email)))
            || results.Any(r => r.MemberNames.Contains(nameof(LoginRequestDto.PhoneNumber))));
    }

    [Theory]
    [InlineData("user@gmail.com")]
    [InlineData("USER@gmail.com")]
    [InlineData("u.ser+tag@gmail.com")]
    public void Validate_ShouldPass_WhenValidEmailExists(string email)
    {
        var dto = new LoginRequestDto
        {
            Email = email,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.DoesNotContain(results, r => r.ErrorMessage == "Vui lòng nhập Email hoặc Số điện thoại.");
    }

    [Theory]
    [InlineData("0912345678")]
    [InlineData("+84912345678")]
    public void Validate_ShouldPass_WhenPhoneExists(string phoneNumber)
    {
        var dto = new LoginRequestDto
        {
            PhoneNumber = phoneNumber,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.DoesNotContain(results, r => r.ErrorMessage == "Vui lòng nhập Email hoặc Số điện thoại.");
    }

    [Theory]
    [InlineData("wrong-email")]
    [InlineData("gmail.com")]
    [InlineData("@gmail.com")]
    public void Validate_ShouldFail_WhenEmailFormatIsInvalid(string email)
    {
        var dto = new LoginRequestDto
        {
            Email = email,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(LoginRequestDto.Email)));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("not-a-phone")]
    public void Validate_ShouldFail_WhenPhoneFormatIsInvalid(string phoneNumber)
    {
        var dto = new LoginRequestDto
        {
            PhoneNumber = phoneNumber,
            Password = "ValidPass123!"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(LoginRequestDto.PhoneNumber)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenPasswordMissing(string? password)
    {
        var dto = new LoginRequestDto
        {
            Email = "user@gmail.com",
            Password = password!
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(LoginRequestDto.Password)));
    }
}

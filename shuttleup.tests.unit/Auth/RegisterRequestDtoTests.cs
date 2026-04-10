using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class RegisterRequestDtoTests
{
    private static RegisterRequestDto CreateValidDto() => new()
    {
        Email = "player@gmail.com",
        Password = "StrongPass1!",
        FullName = "Nguyen Van A",
        PhoneNumber = "0912345678"
    };

    [Fact]
    public void Validate_ShouldPass_WithValidGmailAndStrongPassword()
    {
        var dto = CreateValidDto();

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenEmailIsMissing(string? email)
    {
        var dto = CreateValidDto();
        dto.Email = email!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.Email)));
    }

    [Theory]
    [InlineData("player@yahoo.com")]
    [InlineData("player@fpt.edu.vn")]
    public void Validate_ShouldFail_WhenEmailIsNotGmail(string email)
    {
        var dto = CreateValidDto();
        dto.Email = email;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.ErrorMessage == "Email phải đúng định dạng Gmail (ví dụ: yourname@gmail.com).");
    }

    [Theory]
    [InlineData("playergmail.com")]
    [InlineData("@gmail.com")]
    public void Validate_ShouldFail_WhenEmailFormatInvalid(string email)
    {
        var dto = CreateValidDto();
        dto.Email = email;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.Email)));
    }

    [Theory]
    [InlineData("aaaaaaaa")]
    [InlineData("ABCDEFGH")]
    [InlineData("12345678")]
    [InlineData("Abcdefgh")]
    [InlineData("Ab1!")]
    public void Validate_ShouldFail_WhenPasswordDoesNotMeetComplexity(string password)
    {
        var dto = CreateValidDto();
        dto.Password = password;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.Password)));
    }

    [Theory]
    [InlineData("Aa1!Aa1!")]
    [InlineData("Aa1Aa1Aa")]
    [InlineData("Aa!!Aa!!")]
    public void Validate_ShouldPass_WhenPasswordMeetsAtLeastThreeConditions(string password)
    {
        var dto = CreateValidDto();
        dto.Password = password;

        var results = ValidationTestHelper.Validate(dto);

        Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.Password)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenPhoneNumberIsMissing(string? phoneNumber)
    {
        var dto = CreateValidDto();
        dto.PhoneNumber = phoneNumber!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.PhoneNumber)));
    }

    [Theory]
    [InlineData("09AB")]
    [InlineData("12345678")]
    [InlineData("123456789012")]
    public void Validate_ShouldFail_WhenPhoneNumberIsInvalid(string phoneNumber)
    {
        var dto = CreateValidDto();
        dto.PhoneNumber = phoneNumber;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.ErrorMessage == "Số điện thoại phải gồm 9-11 chữ số.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenFullNameIsMissing(string? fullName)
    {
        var dto = CreateValidDto();
        dto.FullName = fullName!;

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(RegisterRequestDto.FullName)));
    }
}

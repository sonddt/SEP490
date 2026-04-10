using ShuttleUp.BLL.DTOs.Auth;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Auth;

public class GoogleLoginRequestDtoTests
{
    [Fact]
    public void Validate_ShouldPass_WithDefaultRolePlayer()
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = "sample-google-id-token"
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData("PLAYER")]
    [InlineData("MANAGER")]
    [InlineData("player")]
    [InlineData("manager")]
    public void Validate_ShouldPass_WithAllowedSingleRole(string role)
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = "sample-google-id-token",
            Roles = [role]
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Fact]
    public void Validate_ShouldPass_WithAllowedRoleCombination()
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = "sample-google-id-token",
            Roles = ["PLAYER", "MANAGER"]
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Empty(results);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Validate_ShouldFail_WhenIdTokenMissing(string? idToken)
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = idToken!,
            Roles = ["PLAYER"]
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(GoogleLoginRequestDto.IdToken)));
    }

    [Fact]
    public void Validate_ShouldFail_WhenAnyRoleInvalid()
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = "sample-google-id-token",
            Roles = ["PLAYER", "ADMIN"]
        };

        var results = ValidationTestHelper.Validate(dto);

        Assert.Contains(results, r => r.MemberNames.Contains(nameof(GoogleLoginRequestDto.Roles)));
    }

    [Fact]
    public void Validate_ShouldThrow_WhenRolesIsNull()
    {
        var dto = new GoogleLoginRequestDto
        {
            IdToken = "sample-google-id-token",
            Roles = null!
        };

        Assert.Throws<NullReferenceException>(() => ValidationTestHelper.Validate(dto));
    }
}

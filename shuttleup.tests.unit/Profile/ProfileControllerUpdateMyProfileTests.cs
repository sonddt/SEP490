using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Profile;

public class ProfileControllerUpdateMyProfileTests
{
    private static string? ReadMessage(object? payload)
    {
        return payload?
            .GetType()
            .GetProperty("message")?
            .GetValue(payload)?
            .ToString();
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnUnauthorizedObject_WhenUserClaimInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.UpdateMyProfile(new ProfileController.UpdateProfileDto { FullName = "Player" });

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = ReadMessage(unauthorized.Value);
        Assert.NotNull(message);
        Assert.Contains("Phiên đăng nhập không hợp lệ", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnUnauthorizedObject_WhenUserIdClaimIsNotGuid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "not-a-guid") };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };

        var result = await controller.UpdateMyProfile(new ProfileController.UpdateProfileDto { FullName = "Player" });

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = ReadMessage(unauthorized.Value);
        Assert.NotNull(message);
        Assert.Contains("Phiên đăng nhập không hợp lệ", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenDtoNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.UpdateMyProfile(null!);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = ReadMessage(badRequest.Value);
        Assert.Equal("Thiếu dữ liệu cập nhật.", message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenFullNameMissing(string? fullName)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new ProfileController.UpdateProfileDto { FullName = fullName! };
        var result = await controller.UpdateMyProfile(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = ReadMessage(badRequest.Value);
        Assert.Equal("Họ và tên là bắt buộc.", message);
    }

    [Theory]
    [InlineData("not-a-date")]
    [InlineData("2026-99-99")]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenDateOfBirthInvalid(string dob)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "Player",
            DateOfBirth = dob
        };

        var result = await controller.UpdateMyProfile(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = ReadMessage(badRequest.Value);
        Assert.Equal("Ngày sinh không hợp lệ (dùng định dạng yyyy-MM-dd).", message);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnUnauthorizedObject_WhenUserNotFound()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var dto = new ProfileController.UpdateProfileDto { FullName = "Player" };
        var result = await controller.UpdateMyProfile(dto);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = ReadMessage(unauthorized.Value);
        Assert.Equal("Không tìm thấy tài khoản.", message);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenPhoneNumberAlreadyInUse()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        db.Users.AddRange(
            new User
            {
                Id = currentUserId,
                Email = "me@gmail.com",
                FullName = "Me",
                PasswordHash = "hash",
                PhoneNumber = null
            },
            new User
            {
                Id = otherUserId,
                Email = "other@gmail.com",
                FullName = "Other",
                PasswordHash = "hash",
                PhoneNumber = "0123456789"
            }
        );
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, currentUserId);

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "Me Updated",
            PhoneNumber = "0123456789"
        };

        var result = await controller.UpdateMyProfile(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var message = ReadMessage(badRequest.Value);
        Assert.Equal("Số điện thoại đã được sử dụng.", message);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldTrimAndPersistFields_WhenValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Old Name",
            PasswordHash = "hash",
            PhoneNumber = "000",
            Gender = "OLD",
            DateOfBirth = new DateOnly(1999, 12, 31),
            About = "old",
            Address = "old",
            District = "old",
            Province = "old",
            SkillLevel = "old-skill",
            PlayPurpose = "old-purpose",
            PlayFrequency = "old-freq",
            IsPersonalized = false
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "  New Name  ",
            PhoneNumber = "  0900000000  ",
            Gender = "  MALE ",
            DateOfBirth = "2000-01-02",
            About = "  About me  ",
            Address = "  Addr  ",
            District = "  District  ",
            Province = "  Province  ",
            SkillLevel = "  INTERMEDIATE ",
            PlayPurpose = "  FITNESS ",
            PlayFrequency = "  WEEKLY ",
            IsPersonalized = true
        };

        var result = await controller.UpdateMyProfile(dto);

        var ok = Assert.IsType<OkObjectResult>(result);
        var message = ReadMessage(ok.Value);
        Assert.Equal("Cập nhật hồ sơ thành công.", message);

        var updated = await db.Users.FindAsync(userId);
        Assert.NotNull(updated);
        Assert.Equal("New Name", updated!.FullName);
        Assert.Equal("0900000000", updated.PhoneNumber);
        Assert.Equal("MALE", updated.Gender);
        Assert.Equal(new DateOnly(2000, 1, 2), updated.DateOfBirth);
        Assert.Equal("About me", updated.About);
        Assert.Equal("Addr", updated.Address);
        Assert.Equal("District", updated.District);
        Assert.Equal("Province", updated.Province);
        Assert.Equal("INTERMEDIATE", updated.SkillLevel);
        Assert.Equal("FITNESS", updated.PlayPurpose);
        Assert.Equal("WEEKLY", updated.PlayFrequency);
        Assert.True(updated.IsPersonalized);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldAllowClearingOptionalFields_WithWhitespace()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Old Name",
            PasswordHash = "hash",
            PhoneNumber = "0900000000",
            Gender = "MALE",
            About = "About",
            Address = "Addr",
            District = "District",
            Province = "Province"
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "New Name",
            PhoneNumber = "   ",
            Gender = "   ",
            DateOfBirth = "   ",
            About = "   ",
            Address = "   ",
            District = "   ",
            Province = "   "
        };

        var result = await controller.UpdateMyProfile(dto);

        Assert.IsType<OkObjectResult>(result);

        var updated = await db.Users.FindAsync(userId);
        Assert.NotNull(updated);
        Assert.Equal("New Name", updated!.FullName);
        Assert.Null(updated.PhoneNumber);
        Assert.Null(updated.Gender);
        Assert.Null(updated.DateOfBirth);
        Assert.Null(updated.About);
        Assert.Null(updated.Address);
        Assert.Null(updated.District);
        Assert.Null(updated.Province);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldNotOverwritePersonalizationFields_WhenDtoFieldsAreNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Old Name",
            PasswordHash = "hash",
            SkillLevel = "S1",
            PlayPurpose = "P1",
            PlayFrequency = "F1",
            IsPersonalized = false
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "New Name",
            SkillLevel = null,
            PlayPurpose = null,
            PlayFrequency = null,
            IsPersonalized = null
        };

        var result = await controller.UpdateMyProfile(dto);

        Assert.IsType<OkObjectResult>(result);

        var updated = await db.Users.FindAsync(userId);
        Assert.NotNull(updated);
        Assert.Equal("S1", updated!.SkillLevel);
        Assert.Equal("P1", updated.PlayPurpose);
        Assert.Equal("F1", updated.PlayFrequency);
        Assert.False(updated.IsPersonalized);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldBeIdempotent_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Old Name",
            PasswordHash = "hash"
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var dto = new ProfileController.UpdateProfileDto
        {
            FullName = "New Name",
            PhoneNumber = "0900"
        };

        var first = await controller.UpdateMyProfile(dto);
        var second = await controller.UpdateMyProfile(dto);

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<OkObjectResult>(second);

        var updated = await db.Users.FindAsync(userId);
        Assert.NotNull(updated);
        Assert.Equal("New Name", updated!.FullName);
        Assert.Equal("0900", updated.PhoneNumber);
        Assert.Equal(1, db.Users.Count());
    }
}


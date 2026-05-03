using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Profile;

public class ProfileControllerGetMyProfileTests
{
    [Fact]
    public async Task GetMyProfile_ShouldReturnUnauthorizedObject_WhenUserClaimInvalid()
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

        var result = await controller.GetMyProfile();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = unauthorized.Value?
            .GetType()
            .GetProperty("message")?
            .GetValue(unauthorized.Value)?
            .ToString();

        Assert.NotNull(message);
        Assert.Contains("Phiên đăng nhập không hợp lệ", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetMyProfile_ShouldReturnUnauthorizedObject_WhenUserIdClaimIsNotGuid()
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

        var result = await controller.GetMyProfile();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = unauthorized.Value?
            .GetType()
            .GetProperty("message")?
            .GetValue(unauthorized.Value)?
            .ToString();

        Assert.NotNull(message);
        Assert.Contains("Phiên đăng nhập không hợp lệ", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetMyProfile_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.GetMyProfile();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetMyProfile_ShouldUseSubClaimFallback_WhenNameIdentifierMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Player One",
            PasswordHash = "hash",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        var claims = new List<Claim> { new("sub", userId.ToString()) };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };

        var result = await controller.GetMyProfile();

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetMyProfile_ShouldReturnUserRolesAndManagerProfileNull_WhenNoManagerProfile()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var rolePlayer = new Role { Id = Guid.NewGuid(), Name = "PLAYER" };
        var roleManager = new Role { Id = Guid.NewGuid(), Name = "MANAGER" };

        db.Roles.AddRange(rolePlayer, roleManager);
        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Player One",
            PasswordHash = "hash",
            IsActive = true,
            DateOfBirth = new DateOnly(2000, 1, 2),
            Roles = new List<Role> { rolePlayer, roleManager }
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = JsonSerializer.Serialize(ok.Value);
        Assert.Contains("\"managerProfile\":null", payload, StringComparison.Ordinal);
        Assert.Contains("PLAYER", payload, StringComparison.Ordinal);
        Assert.Contains("MANAGER", payload, StringComparison.Ordinal);
        Assert.Contains("2000-01-02", payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetMyProfile_ShouldMapManagerFiles_AndSkipMissingReferencedFiles()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var frontId = Guid.NewGuid();
        var backId = Guid.NewGuid();
        var bl1Id = Guid.NewGuid();
        var blMissingId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = userId,
            Email = "manager@gmail.com",
            FullName = "Manager One",
            PasswordHash = "hash",
            IsActive = true
        });

        db.ManagerProfiles.Add(new ManagerProfile
        {
            UserId = userId,
            TaxCode = "0123456789",
            Address = "Ha Noi",
            Status = "PENDING",
            CccdFrontFileId = frontId,
            CccdBackFileId = backId,
            BusinessLicenseFileId1 = bl1Id,
            BusinessLicenseFileId2 = blMissingId
        });

        db.Files.AddRange(
            new ShuttleUp.DAL.Models.File { Id = frontId, FileUrl = "https://cdn/front.jpg", MimeType = "image/jpeg" },
            new ShuttleUp.DAL.Models.File { Id = backId, FileUrl = "https://cdn/back.jpg", MimeType = "image/jpeg" },
            new ShuttleUp.DAL.Models.File { Id = bl1Id, FileUrl = "https://cdn/bl1.pdf", MimeType = "application/pdf" }
        );
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = JsonSerializer.Serialize(ok.Value);

        Assert.Contains("\"cccdFrontUrl\":\"https://cdn/front.jpg\"", payload, StringComparison.Ordinal);
        Assert.Contains("\"cccdBackUrl\":\"https://cdn/back.jpg\"", payload, StringComparison.Ordinal);
        Assert.Contains("\"businessLicenseFiles\":[", payload, StringComparison.Ordinal);
        Assert.Contains("https://cdn/bl1.pdf", payload, StringComparison.Ordinal);
        Assert.DoesNotContain(blMissingId.ToString(), payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetMyProfile_ShouldBeIdempotent_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Player One",
            PasswordHash = "hash",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var first = await controller.GetMyProfile();
        var second = await controller.GetMyProfile();

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<OkObjectResult>(second);
        Assert.Equal(1, db.Users.Count());
        Assert.Equal(0, db.Files.Count());
    }

    [Fact]
    public async Task GetMyProfile_ShouldReturnAvatarUrl_WhenAvatarFileExists()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var userId = Guid.NewGuid();
        var avatarFileId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File
        {
            Id = avatarFileId,
            FileUrl = "https://cdn/avatar.png",
            MimeType = "image/png"
        });

        db.Users.Add(new User
        {
            Id = userId,
            Email = "player@gmail.com",
            FullName = "Player One",
            PasswordHash = "hash",
            IsActive = true,
            AvatarFileId = avatarFileId
        });

        await db.SaveChangesAsync();

        var fileService = new Mock<IFileService>();
        var controller = new ProfileController(db, fileService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = JsonSerializer.Serialize(ok.Value);

        Assert.Contains("\"avatarUrl\":\"https://cdn/avatar.png\"", payload, StringComparison.Ordinal);
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Profile;

public class ManagerProfileControllerUpdateMyProfileTests
{
    private static string? ReadMessage(object? payload)
    {
        return payload?
            .GetType()
            .GetProperty("message")?
            .GetValue(payload)?
            .ToString();
    }

    private static void SetUser(ControllerBase controller, Guid userId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("sub", userId.ToString())
        };

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };
    }

    private static IFormFile CreateFormFile(long sizeBytes, string contentType, string fileName = "file.bin")
    {
        var ms = new MemoryStream();
        ms.SetLength(sizeBytes);
        ms.Position = 0;

        return new FormFile(ms, 0, sizeBytes, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync((User?)null);

        var config = new Mock<IConfiguration>();

        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            TaxCode = "0123"
        });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenNoUpdatesProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto());

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Bạn chưa cập nhật thông tin nào.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldRequireBothCccdSides_WhenOnlyOneProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            CccdFrontFile = CreateFormFile(10, "image/png", "front.png")
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Nếu upload CCCD thì cần đủ 2 mặt (mặt trước và mặt sau).", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldValidateCccdContentType()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            CccdFrontFile = CreateFormFile(10, "image/gif", "front.gif"),
            CccdBackFile = CreateFormFile(10, "image/png", "back.png")
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("CCCD mặt trước phải là JPG hoặc PNG.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldValidateCccdMaxSize()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var tooBig = 5 * 1024 * 1024 + 1;
        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            CccdFrontFile = CreateFormFile(tooBig, "image/png", "front.png"),
            CccdBackFile = CreateFormFile(10, "image/png", "back.png")
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Ảnh CCCD mặt trước không quá 5MB.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldValidateLicenseMaxCount()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            BusinessLicenseFiles = new List<IFormFile>
            {
                CreateFormFile(10, "application/pdf", "1.pdf"),
                CreateFormFile(10, "application/pdf", "2.pdf"),
                CreateFormFile(10, "application/pdf", "3.pdf"),
                CreateFormFile(10, "application/pdf", "4.pdf")
            }
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Tối đa 3 file giấy phép kinh doanh.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldValidateLicenseContentType()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            BusinessLicenseFiles = new List<IFormFile>
            {
                CreateFormFile(10, "text/plain", "bad.txt")
            }
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Giấy phép kinh doanh chấp nhận JPG, PNG hoặc PDF.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldValidateLicenseMaxSize()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var tooBig = 5 * 1024 * 1024 + 1;
        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            BusinessLicenseFiles = new List<IFormFile>
            {
                CreateFormFile(tooBig, "application/pdf", "1.pdf")
            }
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Mỗi file giấy phép kinh doanh không quá 5MB.", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldEnforceRegistrationRequirements_WhenPendingHasNoDocs()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        // Has some update (taxCode) but still missing docs/address for registration.
        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            TaxCode = "0123"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Thiếu ảnh CCCD (cần đủ 2 mặt).", ReadMessage(bad.Value));
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldCreatePendingRequest_AndUpdateTaxAddress_ForRegistration_WhenPendingAlreadyHasDocs()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var existingPending = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = "PENDING",
            RequestType = "DANG_KY",
            RequestedAt = DateTime.UtcNow.AddDays(-1),
            CccdFrontFileId = Guid.NewGuid(),
            CccdBackFileId = Guid.NewGuid(),
            BusinessLicenseFileId1 = Guid.NewGuid(),
            TaxCode = "OLD",
            Address = "OLD"
        };

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync(existingPending);
        requestRepo.Setup(x => x.UpdateAsync(It.IsAny<ManagerProfileRequest>())).Returns(Task.CompletedTask);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            TaxCode = "  012345  ",
            Address = "  Ha Noi  "
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ok.Value!;
        var message = ReadMessage(payload);

        Assert.Equal("Đã gửi/cập nhật hồ sơ quản lý. Vui lòng chờ Admin duyệt.", message);

        requestRepo.Verify(x => x.UpdateAsync(It.Is<ManagerProfileRequest>(r =>
            r.UserId == userId &&
            r.Status == "PENDING" &&
            r.TaxCode == "012345" &&
            r.Address == "Ha Noi" &&
            r.AdminUserId == null &&
            r.DecisionAt == null &&
            r.DecisionNote == null &&
            r.RequestType == "DANG_KY"
        )), Times.Once);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldSetRequestTypeCapNhat_WhenSnapshotApproved()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var snapshot = new ManagerProfile { UserId = userId, Status = "APPROVED" };

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync(snapshot);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);
        requestRepo.Setup(x => x.AddAsync(It.IsAny<ManagerProfileRequest>())).Returns(Task.CompletedTask);
        requestRepo.Setup(x => x.UpdateAsync(It.IsAny<ManagerProfileRequest>())).Returns(Task.CompletedTask);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            TaxCode = "0123"
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var requestType = ok.Value!
            .GetType()
            .GetProperty("requestType")?
            .GetValue(ok.Value)?
            .ToString();

        Assert.Equal("CAP_NHAT", requestType);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenCloudinaryNotConfigured_ForValidCccdUpload()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync((ManagerProfile?)null);

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync(new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = "PENDING",
            RequestType = "DANG_KY",
            RequestedAt = DateTime.UtcNow,
            TaxCode = "0123",
            Address = "HN",
            BusinessLicenseFileId1 = Guid.NewGuid()
        });
        requestRepo.Setup(x => x.UpdateAsync(It.IsAny<ManagerProfileRequest>())).Returns(Task.CompletedTask);

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Cloudinary:CloudName"]).Returns((string?)null);
        config.Setup(c => c["Cloudinary:ApiKey"]).Returns((string?)null);
        config.Setup(c => c["Cloudinary:ApiSecret"]).Returns((string?)null);

        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            CccdFrontFile = CreateFormFile(10, "image/png", "front.png"),
            CccdBackFile = CreateFormFile(10, "image/png", "back.png")
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Chưa cấu hình Cloudinary", ReadMessage(bad.Value), StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdateMyProfile_ShouldReturnBadRequest_WhenRequestRepoUpdateThrows()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        var repo = new Mock<IManagerProfileRepository>();
        repo.Setup(x => x.GetByUserIdAsync(userId)).ReturnsAsync(new ManagerProfile { UserId = userId, Status = "APPROVED" });

        var requestRepo = new Mock<IManagerProfileRequestRepository>();
        requestRepo.Setup(x => x.GetPendingByUserIdAsync(userId)).ReturnsAsync((ManagerProfileRequest?)null);
        requestRepo.Setup(x => x.AddAsync(It.IsAny<ManagerProfileRequest>())).Returns(Task.CompletedTask);
        requestRepo.Setup(x => x.UpdateAsync(It.IsAny<ManagerProfileRequest>()))
            .ThrowsAsync(new InvalidOperationException("DB write failed"));

        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync(new User
        {
            Id = userId,
            Email = "m@gmail.com",
            FullName = "Manager",
            PasswordHash = "hash"
        });

        var config = new Mock<IConfiguration>();
        var controller = new ManagerProfileController(repo.Object, requestRepo.Object, users.Object, db, config.Object);
        SetUser(controller, userId);

        var result = await controller.UpdateMyProfile(new ManagerProfileController.UpdateMyProfileUploadDto
        {
            TaxCode = "0123"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("DB write failed", ReadMessage(bad.Value));
    }
}


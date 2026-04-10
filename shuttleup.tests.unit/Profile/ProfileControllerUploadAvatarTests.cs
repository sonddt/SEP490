using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Profile;

public class ProfileControllerUploadAvatarTests
{
    private ProfileController CreateController(ShuttleUpDbContext dbContext, IFileService fileService)
    {
        return new ProfileController(dbContext, fileService);
    }

    private class ErrorMessageResponse
    {
        public string Message { get; set; } = "";
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    public static IFormFile CreateMockFormFile(string fileName, string contentType, long length)
    {
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns(fileName);
        mockFile.Setup(f => f.ContentType).Returns(contentType);
        mockFile.Setup(f => f.Length).Returns(length);
        mockFile.Setup(f => f.OpenReadStream()).Returns(new MemoryStream(new byte[length]));
        return mockFile.Object;
    }

    // ══════════════════════════════════════════════════════════
    // 1. UNAUTHORIZED
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadAvatar_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var mockService = new Mock<IFileService>();
        var controller = CreateController(db, mockService.Object);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var file = CreateMockFormFile("avatar.jpg", "image/jpeg", 100);
        var result = await controller.UploadAvatar(file);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. VALIDATION - NULL OR EMPTY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadAvatar_ShouldReturnBadRequest_WhenFileIsNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var mockService = new Mock<IFileService>();
        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.UploadAvatar(null!);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Không tìm thấy file avatar.", err.Message);
    }

    [Fact]
    public async Task UploadAvatar_ShouldReturnBadRequest_WhenFileIsEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var mockService = new Mock<IFileService>();
        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var file = CreateMockFormFile("avatar.jpg", "image/jpeg", 0);
        var result = await controller.UploadAvatar(file);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Không tìm thấy file avatar.", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 3. VALIDATION - NOT IMAGE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadAvatar_ShouldReturnBadRequest_WhenContentTypeNotImage()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var mockService = new Mock<IFileService>();
        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var file = CreateMockFormFile("doc.pdf", "application/pdf", 100);
        var result = await controller.UploadAvatar(file);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Avatar phải là file ảnh.", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 4. CLOUD UPLOAD EXCEPTION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadAvatar_ShouldReturn500_WhenCloudinaryFails()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        db.Users.Add(new User { Id = userId, Email = "test@ex.com", FullName = "Test" });
        await db.SaveChangesAsync();

        var mockService = new Mock<IFileService>();
        mockService.Setup(x => x.UploadAvatarAsync(It.IsAny<IFormFile>(), userId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Cloud provider down"));

        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var file = CreateMockFormFile("avatar.jpg", "image/jpeg", 100);
        var result = await controller.UploadAvatar(file);

        var objRes = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objRes.StatusCode);
        var err = ReadPayload<ErrorMessageResponse>(objRes.Value);
        Assert.Contains("Cloudinary upload exception", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 5. FIRST UPLOAD (Create File record)
    // ══════════════════════════════════════════════════════════
    private class UploadResponse { public string AvatarUrl { get; set; } = ""; }

    [Fact]
    public async Task UploadAvatar_ShouldCreateFileRecordAndLinkToUser_OnFirstUpload()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        db.Users.Add(new User { Id = userId, Email = "test@ex.com", FullName = "Test", AvatarFileId = null });
        await db.SaveChangesAsync();

        var mockService = new Mock<IFileService>();
        mockService.Setup(x => x.UploadAvatarAsync(It.IsAny<IFormFile>(), userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShuttleUp.Backend.Services.FileUploadResult { SecureUrl = "http://cloud/new.jpg", PublicId = "public_id" });

        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var file = CreateMockFormFile("avatar.png", "image/png", 500);
        var result = await controller.UploadAvatar(file);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<UploadResponse>(ok.Value);
        Assert.Equal("http://cloud/new.jpg", data.AvatarUrl);

        var user = db.Users.First(u => u.Id == userId);
        Assert.NotNull(user.AvatarFileId);

        var fileRecord = db.Files.First(f => f.Id == user.AvatarFileId);
        Assert.Equal("http://cloud/new.jpg", fileRecord.FileUrl);
        Assert.Equal("image/png", fileRecord.MimeType);
        Assert.Equal(500, fileRecord.FileSize);
        Assert.Equal($"avatar_{userId}", fileRecord.FileName);
    }

    // ══════════════════════════════════════════════════════════
    // 6. RE-UPLOAD (Update existing File record URL)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadAvatar_ShouldUpdateExistingFileRecord_OnReupload()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var fileId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = fileId, FileUrl = "http://old.jpg" });
        db.Users.Add(new User { Id = userId, Email = "test@ex.com", FullName = "Test", AvatarFileId = fileId });
        await db.SaveChangesAsync();

        var mockService = new Mock<IFileService>();
        mockService.Setup(x => x.UploadAvatarAsync(It.IsAny<IFormFile>(), userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShuttleUp.Backend.Services.FileUploadResult { SecureUrl = "http://new.jpg", PublicId = "new_id" });

        var controller = CreateController(db, mockService.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var file = CreateMockFormFile("v2.jpg", "image/jpeg", 200);
        await controller.UploadAvatar(file);

        var user = db.Users.First(u => u.Id == userId);
        Assert.Equal(fileId, user.AvatarFileId); // Stays the same

        var fileRecord = db.Files.First(f => f.Id == fileId);
        Assert.Equal("http://new.jpg", fileRecord.FileUrl); // URL updated

        Assert.Equal(1, db.Files.Count()); // No new DB row created
    }
}

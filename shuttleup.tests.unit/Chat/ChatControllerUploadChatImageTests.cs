using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.Interfaces;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Chat;

public class ChatControllerUploadChatImageTests
{
    private ChatController CreateController(
        ShuttleUpDbContext db,
        IChatService? chatService = null,
        IFileService? fileService = null,
        Guid? loggedInUserId = null)
    {
        var mockChat = chatService != null ? Mock.Get(chatService) : new Mock<IChatService>();
        var mockFile = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();

        var controller = new ChatController(mockChat.Object, mockFile.Object, db);

        if (loggedInUserId.HasValue)
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
            {
                new Claim(ClaimTypes.NameIdentifier, loggedInUserId.Value.ToString()),
            }, "mock"));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    private static Mock<IFormFile> MakeFile(string contentType = "image/jpeg", long length = 4096, string fileName = "shot.jpg")
    {
        var mock = new Mock<IFormFile>();
        mock.Setup(f => f.ContentType).Returns(contentType);
        mock.Setup(f => f.Length).Returns(length);
        mock.Setup(f => f.FileName).Returns(fileName);
        return mock;
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private class ErrorResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════════════
    // 1. UNAUTHENTICATED — CurrentUserId hard-throws before IsMember check
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadChatImage_ShouldThrow_WhenUserHasNoSubClaim()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        await Assert.ThrowsAnyAsync<Exception>(async () =>
            await controller.UploadChatImage(Guid.NewGuid(), MakeFile().Object));
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. NON-MEMBER — IsMemberAsync returns false → Forbid before file checks
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadChatImage_ShouldReturnForbid_WhenCallerIsNotRoomMember()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, alienId)).ReturnsAsync(false);

        var controller = CreateController(db, chatService: mockChat.Object, loggedInUserId: alienId);

        var result = await controller.UploadChatImage(roomId, MakeFile().Object);
        Assert.IsType<ForbidResult>(result);

        // Membership check must use caller's Id, not any other
        mockChat.Verify(s => s.IsMemberAsync(roomId, alienId), Times.Once);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. PAYLOAD VALIDATION — null file or zero-length
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadChatImage_ShouldReturnBadRequest_WhenFileIsNullOrEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, memberId)).ReturnsAsync(true);

        var controller = CreateController(db, chatService: mockChat.Object, loggedInUserId: memberId);

        // Null file
        var r1 = await controller.UploadChatImage(roomId, null!);
        Assert.Contains("vui lòng chọn ảnh", ReadPayload<ErrorResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        // Zero-length file
        var emptyFile = MakeFile(length: 0);
        var r2 = await controller.UploadChatImage(roomId, emptyFile.Object);
        Assert.Contains("vui lòng chọn ảnh", ReadPayload<ErrorResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. MIME-TYPE FILTER — PDF, zip, MP4 must be rejected
    // ══════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("application/pdf", "report.pdf")]
    [InlineData("application/zip", "archive.zip")]
    [InlineData("video/mp4", "clip.mp4")]
    [InlineData("text/plain", "note.txt")]
    public async Task UploadChatImage_ShouldReturnBadRequest_WhenFileIsNotAnImage(string contentType, string fileName)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, memberId)).ReturnsAsync(true);

        var controller = CreateController(db, chatService: mockChat.Object, loggedInUserId: memberId);

        var badFile = MakeFile(contentType: contentType, fileName: fileName);
        var result = await controller.UploadChatImage(roomId, badFile.Object);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chỉ được đính kèm file ảnh", ReadPayload<ErrorResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. CLOUDINARY FAILURE — UploadChatImageAsync throws → 500
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadChatImage_ShouldReturn500_WhenFileServiceThrows()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, memberId)).ReturnsAsync(true);

        var mockFile = new Mock<IFileService>();
        mockFile
            .Setup(f => f.UploadChatImageAsync(It.IsAny<IFormFile>(), roomId, memberId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Cloudinary API rate limit exceeded."));

        var controller = CreateController(db, chatService: mockChat.Object, fileService: mockFile.Object, loggedInUserId: memberId);

        var result = await controller.UploadChatImage(roomId, MakeFile().Object);

        var serverError = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, serverError.StatusCode);
        Assert.Contains("tải ảnh lên thất bại", ReadPayload<ErrorResponse>(serverError.Value).Message.ToLowerInvariant());
        Assert.Contains("cloudinary api rate limit", ReadPayload<ErrorResponse>(serverError.Value).Message.ToLowerInvariant());

        // On failure, nothing must be written to the DB
        Assert.Empty(db.Files.ToList());
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. HAPPY PATH — File entity persisted, Ok with fileId + url returned
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UploadChatImage_ShouldPersistFileRowAndReturnFileIdAndUrl_WhenSuccessful()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        const string cloudinaryUrl = "https://res.cloudinary.com/shuttleup/image/upload/v123/chat.png";

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, memberId)).ReturnsAsync(true);

        var mockFile = new Mock<IFileService>();
        mockFile
            .Setup(f => f.UploadChatImageAsync(It.IsAny<IFormFile>(), roomId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((It.IsAny<string>(), cloudinaryUrl));

        var controller = CreateController(db, chatService: mockChat.Object, fileService: mockFile.Object, loggedInUserId: memberId);

        var imageFile = MakeFile(contentType: "image/png", fileName: "chat.png");
        var result = await controller.UploadChatImage(roomId, imageFile.Object);
        var ok = Assert.IsType<OkObjectResult>(result);

        // JSON payload assertions
        var payload = ReadPayload<JsonElement>(ok.Value);
        var returnedUrl = payload.GetProperty("url").GetString();
        var returnedFileId = payload.GetProperty("fileId").GetString();

        Assert.Equal(cloudinaryUrl, returnedUrl);
        Assert.NotNull(returnedFileId); // Must be a valid non-empty GUID string
        Assert.True(Guid.TryParse(returnedFileId, out _));

        // DB persistence: exactly one File row written
        var savedFiles = db.Files.ToList();
        Assert.Single(savedFiles);

        var savedFile = savedFiles[0];
        Assert.Equal(cloudinaryUrl, savedFile.FileUrl);
        Assert.Equal("image/png", savedFile.MimeType);
        Assert.Equal("chat.png", savedFile.FileName);
        Assert.Equal(memberId, savedFile.UploadedByUserId);
        Assert.Equal(4096, savedFile.FileSize);
        Assert.Equal(Guid.Parse(returnedFileId!), savedFile.Id); // FileId in response matches DB PK
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. BOUNDARY — image/* variants all accepted (png, gif, webp, etc.)
    // ══════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("image/png",  "photo.png")]
    [InlineData("image/gif",  "anim.gif")]
    [InlineData("image/webp", "modern.webp")]
    [InlineData("image/heic", "iphone.heic")]
    public async Task UploadChatImage_ShouldAcceptAllImageSubtypes(string contentType, string fileName)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockChat = new Mock<IChatService>();
        mockChat.Setup(s => s.IsMemberAsync(roomId, memberId)).ReturnsAsync(true);

        var mockFile = new Mock<IFileService>();
        mockFile
            .Setup(f => f.UploadChatImageAsync(It.IsAny<IFormFile>(), roomId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((It.IsAny<string>(), "https://cdn.example.com/img"));

        var controller = CreateController(db, chatService: mockChat.Object, fileService: mockFile.Object, loggedInUserId: memberId);

        var file = MakeFile(contentType: contentType, fileName: fileName);
        var result = await controller.UploadChatImage(roomId, file.Object);

        Assert.IsType<OkObjectResult>(result);
    }
}

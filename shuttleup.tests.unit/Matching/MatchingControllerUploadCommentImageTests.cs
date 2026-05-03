using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerUploadCommentImageTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        IFileService? fileService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();
        var mockActivity = new Mock<IMatchingPostActivityService>();

        var controller = new MatchingController(
            dbContext,
            mockNotify.Object,
            mockFile.Object,
            mockActivity.Object
        );

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
                HttpContext = new DefaultHttpContext()
            };
        }

        return controller;
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & PRIVILEGE CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCommentImage_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        // Dummy payload
        var mockFile = new Mock<IFormFile>();
        var result = await controller.UploadCommentImage(Guid.NewGuid(), mockFile.Object);
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task UploadCommentImage_ShouldReturnForbid_WhenNonMemberTriesToUploadImageToThread()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() }); 
        // Notice: `alienUserId` is completely absent from `MatchingMembers`.
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: alienUserId);

        var mockFile = new Mock<IFormFile>();
        var result = await controller.UploadCommentImage(postId, mockFile.Object);
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE LOCKDOWN & FILE VALIDATION METRICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCommentImage_ShouldReturnBadRequest_WhenPostIsInactiveOrFileFailsPayloadValidation()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid(); 
        var inactivePostId = Guid.NewGuid();
        var activePostId = Guid.NewGuid();

        // Scene A: Inactive Thread
        var inactivePost = new MatchingPost { Id = inactivePostId, CreatorUserId = memberId, Status = "INACTIVE" };
        inactivePost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = inactivePostId, UserId = memberId });
        db.MatchingPosts.Add(inactivePost);

        // Scene B: Active Thread
        var activePost = new MatchingPost { Id = activePostId, CreatorUserId = memberId, Status = "OPEN" };
        activePost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = activePostId, UserId = memberId });
        db.MatchingPosts.Add(activePost);

        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // --- TEST 1: Hit INACTIVE thread ---
        var mockValidFile = new Mock<IFormFile>();
        mockValidFile.Setup(f => f.Length).Returns(1024);
        mockValidFile.Setup(f => f.ContentType).Returns("image/jpeg");

        var resInactive = await controller.UploadCommentImage(inactivePostId, mockValidFile.Object);
        Assert.Contains("đã kết thúc", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resInactive).Value).Message.ToLowerInvariant());

        // --- TEST 2: Hit Active Thread but file is completely missing (Length 0) ---
        var mockZeroFile = new Mock<IFormFile>();
        mockZeroFile.Setup(f => f.Length).Returns(0);
        var resMissing = await controller.UploadCommentImage(activePostId, mockZeroFile.Object);
        Assert.Contains("chọn ảnh", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resMissing).Value).Message.ToLowerInvariant());

        // --- TEST 3: Hit Active Thread but injected a PDF vector attack instead of an Image ---
        var mockPdfFile = new Mock<IFormFile>();
        mockPdfFile.Setup(f => f.Length).Returns(1024);
        mockPdfFile.Setup(f => f.ContentType).Returns("application/pdf");
        var resFormat = await controller.UploadCommentImage(activePostId, mockPdfFile.Object);
        Assert.Contains("chỉ được đính kèm file ảnh", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resFormat).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. CLOUDINARY EXCEPTION TRAPPING 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCommentImage_ShouldReturn500_WhenFileServiceEncountersCloudinaryCrash()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(1024);
        mockFile.Setup(f => f.ContentType).Returns("image/png");

        var mockFileService = new Mock<IFileService>();
        // Hard-crash the Cloudinary trace to test exception trapping
        mockFileService.Setup(f => f.UploadMatchingCommentImageAsync(It.IsAny<IFormFile>(), postId, memberId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Cloudinary quota exceeded!"));

        var controller = CreateController(db, fileService: mockFileService.Object, loggedInUserId: memberId);

        var result = await controller.UploadCommentImage(postId, mockFile.Object);
        
        var serverError = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, serverError.StatusCode);
        Assert.Contains("cloudinary quota exceeded", ReadPayload<ErrorMessageResponse>(serverError.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH - RECORD MAPPING LOGIC
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCommentImage_ShouldMapPhysicalFileDatabaseRecordAndReturnSecurePayload_WhenSuccessfullyUploaded()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(4096);
        mockFile.Setup(f => f.ContentType).Returns("image/png");
        mockFile.Setup(f => f.FileName).Returns("screenshot_evidence.png");

        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(f => f.UploadMatchingCommentImageAsync(It.IsAny<IFormFile>(), postId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((It.IsAny<string>(), "https://res.cloudinary.com/shuttleup/image/upload/v1234/evidence.png"));

        var controller = CreateController(db, fileService: mockFileService.Object, loggedInUserId: memberId);

        var result = await controller.UploadCommentImage(postId, mockFile.Object);
        var ok = Assert.IsType<OkObjectResult>(result);
        
        // Assert API Return Signature
        var returnObj = ReadPayload<JsonElement>(ok.Value);
        Assert.Equal("https://res.cloudinary.com/shuttleup/image/upload/v1234/evidence.png", returnObj.GetProperty("url").GetString());
        var mappedFileId = returnObj.GetProperty("fileId").GetGuid();

        // Assert EF Core Database Sink Trace
        var savedFile = db.Files.FirstOrDefault(f => f.Id == mappedFileId);
        Assert.NotNull(savedFile);
        Assert.Equal(4096, savedFile.FileSize);
        Assert.Equal("image/png", savedFile.MimeType);
        Assert.Equal("screenshot_evidence.png", savedFile.FileName);
    }
}

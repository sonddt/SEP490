using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.MatchingController;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerPostCommentTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        INotificationDispatchService? notifyService = null,
        IMatchingPostActivityService? activityService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockActivity = activityService != null ? Mock.Get(activityService) : new Mock<IMatchingPostActivityService>();

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
    // 1. ISOLATION & PRIVILEGE SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PostComment_ShouldReturnUnauthorizedOrForbid_WhenAccessIsViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() });
        // No group membership granted!
        await db.SaveChangesAsync();

        // 1. Completely Anonymous
        var controllerAnon = CreateController(db, loggedInUserId: null);
        var resAnon = await controllerAnon.PostComment(Guid.NewGuid(), new CommentDto());
        Assert.IsType<UnauthorizedResult>(resAnon);

        // 2. Extraneous user 
        var controllerAlien = CreateController(db, loggedInUserId: alienUserId);
        var resAlien = await controllerAlien.PostComment(postId, new CommentDto());
        Assert.IsType<ForbidResult>(resAlien);
    }

    // ══════════════════════════════════════════════════════════
    // 2. NESTING PARADOX & BINARY ATTACK VALIDATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PostComment_ShouldReturnBadRequest_WhenParentIsDeepNestedOrMissing_OrAttachmentIsForeign()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        
        // Setup Invalid Nesting
        var root = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = null };
        var deeplyNestedChild = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = root.Id, IsDeleted = false }; // Level 2
        var deletedRoot = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = null, IsDeleted = true };

        // Setup File Attacks
        var alienFile = new ShuttleUp.DAL.Models.File { Id = Guid.NewGuid(), UploadedByUserId = Guid.NewGuid(), MimeType = "image/png" };
        var badFormatFile = new ShuttleUp.DAL.Models.File { Id = Guid.NewGuid(), UploadedByUserId = memberId, MimeType = "application/zip" };

        db.MatchingPosts.Add(post);
        db.MatchingPostComments.AddRange(root, deeplyNestedChild, deletedRoot);
        db.Files.AddRange(alienFile, badFormatFile);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Threat 1: Replying to a REPLY (Recursion forbidden)
        var res1 = await controller.PostComment(postId, new CommentDto { Content = "Test", ParentCommentId = deeplyNestedChild.Id });
        Assert.Contains("trả lời được một cấp", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res1).Value).Message.ToLowerInvariant());

        // Threat 2: Replying to Ghost
        var res2 = await controller.PostComment(postId, new CommentDto { Content = "Test", ParentCommentId = deletedRoot.Id });
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res2).Value).Message.ToLowerInvariant());

        // Threat 3: Binding someone else's file ID
        var res3 = await controller.PostComment(postId, new CommentDto { Content = "Test", AttachmentFileId = alienFile.Id });
        Assert.Contains("không hợp lệ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res3).Value).Message.ToLowerInvariant());

        // Threat 4: Binding a non-image file
        var res4 = await controller.PostComment(postId, new CommentDto { Content = "Test", AttachmentFileId = badFormatFile.Id });
        Assert.Contains("chỉ được đính kèm", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res4).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. SPAM TRAPPING (TELETRAFFIC DDOS PROTECTION)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PostComment_ShouldReturn429TooManyRequests_WhenRateLimitViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        
        // Simulating the user literally JUST posted an item 100 milliseconds ago mathematically...
        var previousComment = new MatchingPostComment 
        { 
            Id = Guid.NewGuid(), PostId = postId, UserId = memberId, 
            CreatedAt = DateTime.UtcNow.AddMilliseconds(-100) 
        };
        
        db.MatchingPosts.Add(post);
        db.MatchingPostComments.Add(previousComment);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var result = await controller.PostComment(postId, new CommentDto { Content = "SPAM!" });
        var overflow = Assert.IsType<ObjectResult>(result);
        
        // Assert native limit cap!
        Assert.Equal(429, overflow.StatusCode);
        Assert.Contains("gửi quá nhanh", ReadPayload<ErrorMessageResponse>(overflow.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. CASCADE PING TELEMETRY VERIFICATION 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PostComment_ShouldPingSpecificAudiencesWithExactTargeting_WhenPostingReplies()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        
        var callerId = Guid.NewGuid(); // Random active player posting
        var hostId = Guid.NewGuid();
        var parentAuthorId = Guid.NewGuid(); // Another player whose comment is being replied to
        var postId = Guid.NewGuid();

        // Must inject user entities for String Interpolation mappings safely
        db.Users.Add(new User { Id = callerId, FullName = "Huy The Poster" });
        db.Users.Add(new User { Id = hostId, FullName = "Nam Host" });
        db.Users.Add(new User { Id = parentAuthorId, FullName = "Lan Author" });

        var post = new MatchingPost { Id = postId, CreatorUserId = hostId, Status = "OPEN" };
        
        // Every single person is an authenticated valid member!
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = hostId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = parentAuthorId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = callerId });
        db.MatchingPosts.Add(post);

        var rootComment = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = parentAuthorId };
        db.MatchingPostComments.Add(rootComment);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, notifyService: mockNotify.Object, loggedInUserId: callerId);

        // Core Trigger: The Caller is replying exactly to `Lan Author`'s root comment!
        var dto = new CommentDto { Content = "Sounds great!", ParentCommentId = rootComment.Id };
        
        var result = await controller.PostComment(postId, dto);
        Assert.IsType<OkObjectResult>(result);

        // 1. Confirm Ping to HOST (Because it's their thread)
        mockNotify.Verify(n => n.NotifyUserAsync(
            hostId,
            NotificationTypes.MatchingCommentReply,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);

        // 2. Confirm SEPARATE Ping uniquely addressed to the ROOT AUTHOR (Because their comment specifically was targeted)
        mockNotify.Verify(n => n.NotifyUserAsync(
            parentAuthorId,
            NotificationTypes.MatchingCommentReply,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
            
        // Final assertion: Confirm no one else got pinged, specifically the Caller themselves!
        mockNotify.Verify(n => n.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<NotificationTypes>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), false, It.IsAny<CancellationToken>()), 
            Times.Exactly(2)); // Exact 2 explicit pings required!
    }
}

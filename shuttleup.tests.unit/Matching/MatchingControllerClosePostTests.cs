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

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerClosePostTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        INotificationDispatchService? notifyService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
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
    // 1. ISOLATION & PRIVILEGE SECRECY (NotFound)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task ClosePost_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.ClosePost(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task ClosePost_ShouldReturnNotFound_WhenHostDoesnNotOwnPost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var alienPostId = Guid.NewGuid();

        // Foreign Post
        db.MatchingPosts.Add(new MatchingPost { Id = alienPostId, CreatorUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.ClosePost(alienPostId);
        var bad = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE CHECKS ON ENDPOINTS (Status Lockdown)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task ClosePost_ShouldReturnBadRequest_WhenPostAlreadyInactivationExpired()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var inactiveId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = inactiveId, CreatorUserId = myUserId, Status = "INACTIVE" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.ClosePost(inactiveId);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("không thể đóng", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - CASCADING CANCELLATION & NOTIFICATIONS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task ClosePost_ShouldCancelAllPendingRequestsAndNotifyConfirmedGuests_WhenClosedSuccessfully()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var confirmedGuestId = Guid.NewGuid();
        var rejectedPingId = Guid.NewGuid(); // To prove we don't accidentally revive rejected users 

        // Important: Host record must exist because system fetches HostFullName natively using .FirstAsync() to embed in notice.
        db.Users.Add(new User { Id = hostId, FullName = "Hieu Host" }); 

        var post = new MatchingPost 
        { 
            Id = postId, CreatorUserId = hostId, Title = "Friday Arena", Status = "OPEN" 
        };
        
        // Members List (1 Host, 1 Valid Guest)
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = hostId, PostId = postId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = confirmedGuestId, PostId = postId });

        // Join Request Queue (1 Pending, 1 Already Rejected)
        var pending1 = new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = postId, Status = "PENDING", UserId = Guid.NewGuid() };
        var pending2 = new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = postId, Status = "PENDING", UserId = Guid.NewGuid() };
        var rejectedQueue = new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = postId, Status = "REJECTED", UserId = rejectedPingId };
        
        post.MatchingJoinRequests.Add(pending1);
        post.MatchingJoinRequests.Add(pending2);
        post.MatchingJoinRequests.Add(rejectedQueue);

        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, notifyService: mockNotify.Object, loggedInUserId: hostId);

        var result = await controller.ClosePost(postId);
        Assert.IsType<OkObjectResult>(result);

        // Core Cascade Assertion: Were pending items cleanly terminated?
        Assert.Equal("CANCELLED", pending1.Status);
        Assert.Equal("CANCELLED", pending2.Status);
        
        // Ensure previously rejected items didn't get accidentally overwritten into Cancelled!
        Assert.Equal("REJECTED", rejectedQueue.Status);

        // Model Master Status Assert
        Assert.Equal("CLOSED", post.Status);

        // Side-Effect Assertion: Ensure ONLY confirmed guest receives websocket ping, and host successfully bypasses self!
        mockNotify.Verify(n => n.NotifyUserAsync(
            confirmedGuestId,
            NotificationTypes.MatchingPostClosed,
            "Bài đăng đã đóng",
            $@"Hieu Host đã đóng bài đăng ""Friday Arena"".",
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
            
        // Validates Ping count is structurally precise. Host shouldn't ping themselves!
        mockNotify.Verify(n => n.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<NotificationTypes>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), false, It.IsAny<CancellationToken>()), 
            Times.Once); // The ONLY call should have been to confirmedGuestId.
    }
}

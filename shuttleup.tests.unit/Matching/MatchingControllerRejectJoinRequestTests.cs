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

public class MatchingControllerRejectJoinRequestTests
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
    // 1. ISOLATION & SECRECY 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RejectJoinRequest_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.RejectJoinRequest(Guid.NewGuid(), new RejectDto());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task RejectJoinRequest_ShouldReturnNotFound_WhenRequestDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: Guid.NewGuid());

        var result = await controller.RejectJoinRequest(Guid.NewGuid(), new RejectDto());
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task RejectJoinRequest_ShouldReturnForbid_WhenNonHostAttemptsToRejectPlayer()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() }; // Real Host is isolated away
        var request = new MatchingJoinRequest { Id = requestId, PostId = postId, Post = post };
        
        db.MatchingPosts.Add(post);
        db.MatchingJoinRequests.Add(request);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: alienUserId);

        // A player cannot maliciously hijack the host's route to reject another player! 
        var result = await controller.RejectJoinRequest(requestId, new RejectDto());
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE VALIDATION & GHOST STATE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RejectJoinRequest_ShouldReturnBadRequest_WhenPostIsInactiveOrRequestIsAlreadyResolved()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();

        var inactivePost = new MatchingPost { Id = Guid.NewGuid(), CreatorUserId = hostId, Status = "INACTIVE" };
        var reqOnInactive = new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = inactivePost.Id, Post = inactivePost, Status = "PENDING" };

        var openPost = new MatchingPost { Id = Guid.NewGuid(), CreatorUserId = hostId, Status = "OPEN" };
        var reqAlreadyHandled = new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = openPost.Id, Post = openPost, Status = "REJECTED" }; 

        db.MatchingPosts.Add(inactivePost);
        db.MatchingPosts.Add(openPost);
        db.MatchingJoinRequests.Add(reqOnInactive);
        db.MatchingJoinRequests.Add(reqAlreadyHandled);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: hostId);

        // 1. Inactive State (Match started)
        var res1 = await controller.RejectJoinRequest(reqOnInactive.Id, new RejectDto());
        var bad1 = Assert.IsType<BadRequestObjectResult>(res1);
        Assert.Contains("đã kết thúc", ReadPayload<ErrorMessageResponse>(bad1.Value).Message.ToLowerInvariant());

        // 2. Double Reject / Already Accepted Status
        var res2 = await controller.RejectJoinRequest(reqAlreadyHandled.Id, new RejectDto());
        var bad2 = Assert.IsType<BadRequestObjectResult>(res2);
        Assert.Contains("đã được xử lý", ReadPayload<ErrorMessageResponse>(bad2.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. CAUSALITY MAP (REJECT REASON NOTIFICATIONS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RejectJoinRequest_ShouldSetStatusToRejectedAndNotifyUserWithExactReason_WhenExecutionSucceeds()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var applicantId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        // Host name is explicitly extracted internally for the ping format
        db.Users.Add(new User { Id = hostId, FullName = "Hieu The Host" });

        var post = new MatchingPost { Id = postId, CreatorUserId = hostId, Status = "OPEN", Title = "Master Series" };
        var request = new MatchingJoinRequest { Id = requestId, PostId = postId, Post = post, UserId = applicantId, Status = "PENDING" };

        db.MatchingPosts.Add(post);
        db.MatchingJoinRequests.Add(request);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, notifyService: mockNotify.Object, loggedInUserId: hostId);

        var dto = new RejectDto { Reason = "Nhóm cần trình cao hơn, sory bạn!" };
        var result = await controller.RejectJoinRequest(requestId, dto);
        
        Assert.IsType<OkObjectResult>(result);

        // EF Update Mapping Assertion
        Assert.Equal("REJECTED", request.Status);
        Assert.Equal("Nhóm cần trình cao hơn, sory bạn!", request.RejectReason);

        // Websocket String Interpolation Validation
        mockNotify.Verify(n => n.NotifyUserAsync(
            applicantId,
            NotificationTypes.MatchingJoinRejected,
            "Yêu cầu chưa được duyệt",
            // Notice: The trailing reason mapping string concatenates safely
            $@"Yêu cầu tham gia ""Master Series"" chưa được duyệt. Lý do: Nhóm cần trình cao hơn, sory bạn!",
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }
}

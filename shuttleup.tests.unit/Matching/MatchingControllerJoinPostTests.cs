using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.MatchingController;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerJoinPostTests
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
    // 1. FUNDAMENTAL ISOLATION & BAD ENDPOINT CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task JoinPost_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.JoinPost(Guid.NewGuid(), new JoinDto());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task JoinPost_ShouldReturnNotFound_WhenAccessingGhostPost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: Guid.NewGuid());

        var result = await controller.JoinPost(Guid.NewGuid(), new JoinDto());
        var bad = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE METASTATE & OPEN SLOT CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task JoinPost_ShouldReturnBadRequest_WhenPostIsInactiveOrStatusNotOpen()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var inactiveId = Guid.NewGuid();
        var fullId = Guid.NewGuid();

        // Target Status Lockdowns. (Note: These bypass ownership checks natively so anyone can hit these rules).
        db.MatchingPosts.Add(new MatchingPost { Id = inactiveId, CreatorUserId = Guid.NewGuid(), Status = "INACTIVE" });
        db.MatchingPosts.Add(new MatchingPost { Id = fullId, CreatorUserId = Guid.NewGuid(), Status = "FULL" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var resInactive = await controller.JoinPost(inactiveId, new JoinDto());
        Assert.Contains("đã kết thúc", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resInactive).Value).Message.ToLowerInvariant());

        var resFull = await controller.JoinPost(fullId, new JoinDto());
        Assert.Contains("không còn nhận", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resFull).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. INTERNAL MEMBER & PERMISSION PARADOXES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task JoinPost_ShouldReturnBadRequest_WhenApplyingToSelfOwnedOrAlreadyJoinedOrAlreadyPendingPost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var selfOwnedId = Guid.NewGuid();
        var alreadyMemberId = Guid.NewGuid();
        var alreadyPendingId = Guid.NewGuid();

        // Paradox 1: Joining your OWN post
        db.MatchingPosts.Add(new MatchingPost { Id = selfOwnedId, CreatorUserId = myUserId, Status = "OPEN" });

        // Paradox 2: Joining a post you are already physically sitting inside
        var memPost = new MatchingPost { Id = alreadyMemberId, CreatorUserId = Guid.NewGuid(), Status = "OPEN" };
        memPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = alreadyMemberId, UserId = myUserId });
        db.MatchingPosts.Add(memPost);

        // Paradox 3: Spamming Join requests when you already have one sitting actively as PENDING
        db.MatchingPosts.Add(new MatchingPost { Id = alreadyPendingId, CreatorUserId = Guid.NewGuid(), Status = "OPEN" });
        db.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = alreadyPendingId, UserId = myUserId, Status = "PENDING" });
        
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var r1 = await controller.JoinPost(selfOwnedId, new JoinDto());
        Assert.Contains("đã là chủ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        var r2 = await controller.JoinPost(alreadyMemberId, new JoinDto());
        Assert.Contains("đã là thành viên", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());

        var r3 = await controller.JoinPost(alreadyPendingId, new JoinDto());
        Assert.Contains("đã gửi yêu cầu", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r3).Value).Message.ToLowerInvariant());
    }
    
    [Fact]
    public async Task JoinPost_ShouldReturnBadRequest_WhenApplyingToAnOpenPostWhosePhysicsAreActuallyFull_ButStatusIsLagging()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var myUserId = Guid.NewGuid();

        // Edge case: Post is stuck on 'OPEN' but physically contains maximum allowed capacities!
        var laggyPost = new MatchingPost 
        { 
            Id = targetId, CreatorUserId = Guid.NewGuid(), Status = "OPEN", RequiredPlayers = 1 
        };
        // Slots = Required(1) + Host(1) = 2 players maximum.
        laggyPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = Guid.NewGuid() }); // Host
        laggyPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = Guid.NewGuid() }); // Guest occupying final spot
        
        db.MatchingPosts.Add(laggyPost);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var paradox = await controller.JoinPost(targetId, new JoinDto());
        var bad = Assert.IsType<BadRequestObjectResult>(paradox);
        Assert.Contains("đã đủ người", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH - TICKET GENERATION AND PING MECHANICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task JoinPost_ShouldQueuePendingTicketAndNotifyHost_WhenValidApplicationSubmitted()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var myUserId = Guid.NewGuid();
        var hostId = Guid.NewGuid();

        // Mock exact user entity lookup for explicit socket tracing
        db.Users.Add(new User { Id = myUserId, FullName = "Huy Guest" });

        var post = new MatchingPost 
        { 
            Id = targetId, CreatorUserId = hostId, Title = "Weekend Doubles", Status = "OPEN", RequiredPlayers = 1 
        };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = hostId }); // Just the host so far.
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, notifyService: mockNotify.Object, loggedInUserId: myUserId);

        var dto = new JoinDto { Message = "I can bring new shuttles!" };
        var result = await controller.JoinPost(targetId, dto);
        
        var ok = Assert.IsType<OkObjectResult>(result);

        // Core Tracking Assertions
        var pendingTicket = await db.MatchingJoinRequests.FirstOrDefaultAsync(r => r.PostId == targetId && r.UserId == myUserId);
        Assert.NotNull(pendingTicket);
        Assert.Equal("PENDING", pendingTicket.Status);
        Assert.Equal("I can bring new shuttles!", pendingTicket.Message);

        // Subsurface Websocket Assertion check tracing host target natively
        mockNotify.Verify(n => n.NotifyUserAsync(
            hostId,
            NotificationTypes.MatchingJoinRequest,
            "Yêu cầu tham gia mới",
            $@"Huy Guest muốn tham gia ""Weekend Doubles"".",
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }
}

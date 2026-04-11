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

public class MatchingControllerRemoveMemberTests
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
    // 1. ISOLATION & PRIVILEGE CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RemoveMember_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.RemoveMember(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task RemoveMember_ShouldReturnNotFound_WhenTargetMemberGhosted()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: Guid.NewGuid()); // Random user

        var result = await controller.RemoveMember(Guid.NewGuid());
        var bad = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task RemoveMember_ShouldReturnForbid_WhenAlienAttemptsToKickSomeoneElse()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var attackerId = Guid.NewGuid();
        var hostId = Guid.NewGuid();
        var victimId = Guid.NewGuid();
        var victimMemberId = Guid.NewGuid();

        var post = new MatchingPost { Id = Guid.NewGuid(), CreatorUserId = hostId }; 
        var targetMemberToKick = new MatchingMember { Id = victimMemberId, Post = post, UserId = victimId };

        db.MatchingPosts.Add(post);
        db.MatchingMembers.Add(targetMemberToKick);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: attackerId);

        // Security Assertion: Attacker is neither the HOST, nor the VICTIM themselves!
        var r = await controller.RemoveMember(victimMemberId);
        Assert.IsType<ForbidResult>(r);
    }

    // ══════════════════════════════════════════════════════════
    // 2. PARADOX VALIDATION (HOST METASTATE)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RemoveMember_ShouldReturnBadRequest_WhenHostAttemptsToKickThemselves()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var hostMemberId = Guid.NewGuid();

        var post = new MatchingPost { Id = Guid.NewGuid(), CreatorUserId = hostId }; 
        var hostMemberRecord = new MatchingMember { Id = hostMemberId, Post = post, UserId = hostId }; // Target is HOST

        db.MatchingPosts.Add(post);
        db.MatchingMembers.Add(hostMemberRecord);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: hostId);

        // Hosts cannot leave groups gracefully. They must physically hit "Close Post" instead to collapse the matrix.
        var result = await controller.RemoveMember(hostMemberId);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chủ bài đăng", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - CAPACITY RECOVERY & PING METRICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task RemoveMember_ShouldSoftOpenFullPostAndBypassWebsocket_WhenPlayerLeavesVoluntarily()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var playerId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var playerMemberId = Guid.NewGuid();

        // Edge case structure: The post is physically packed and capped to "FULL"
        var post = new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid(), Status = "FULL", Title = "Master" };
        var playerMemberState = new MatchingMember { Id = playerMemberId, PostId = postId, UserId = playerId };

        db.MatchingPosts.Add(post);
        db.MatchingMembers.Add(playerMemberState);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var mockActivity = new Mock<IMatchingPostActivityService>();
        
        // Context configures logged in user AS the player themselves
        var controller = CreateController(db, notifyService: mockNotify.Object, activityService: mockActivity.Object, loggedInUserId: playerId);

        var result = await controller.RemoveMember(playerMemberId);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("bạn đã rời khỏi nhóm", ReadPayload<ErrorMessageResponse>(ok.Value).Message.ToLowerInvariant());

        // Capacity Recovery Assert: Memory matrix MUST flush the post to 'OPEN' since a spot just opened up!
        Assert.Equal("OPEN", post.Status);
        
        // Tracking Asserts
        Assert.Empty(db.MatchingMembers.ToList()); // The DB effectively purged the object
        mockActivity.Verify(a => a.EnsurePostInactiveIfElapsedAsync(postId, It.IsAny<CancellationToken>()), Times.Once);

        // Subsurface assertion: Ping system MUST NOT fire when a player leaves voluntarily on their own accord!
        mockNotify.Verify(n => n.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<NotificationTypes>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), false, It.IsAny<CancellationToken>()), 
            Times.Never);
    }
    
    [Fact]
    public async Task RemoveMember_ShouldPingPlayerAccurately_WhenPlayerIsKickedByHost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var victimId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var victimMemberId = Guid.NewGuid();

        // Notice: Host table mapping mapped for precise interpolation logic
        db.Users.Add(new User { Id = hostId, FullName = "God Host" });

        var post = new MatchingPost { Id = postId, CreatorUserId = hostId, Status = "OPEN", Title = "Expert Court" };
        var victimState = new MatchingMember { Id = victimMemberId, PostId = postId, UserId = victimId };

        db.MatchingPosts.Add(post);
        db.MatchingMembers.Add(victimState);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, notifyService: mockNotify.Object, loggedInUserId: hostId);

        var result = await controller.RemoveMember(victimMemberId);
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Contains("đã xóa thành viên khỏi nhóm", ReadPayload<ErrorMessageResponse>(ok.Value).Message.ToLowerInvariant());

        // Assert Notification Matrix - System must proactively ping the kicked player exposing the host name safely.
        mockNotify.Verify(n => n.NotifyUserAsync(
            victimId,
            NotificationTypes.MatchingMemberKicked,
            It.IsAny<string>(),
            $@"Bạn đã bị xóa khỏi nhóm ""Expert Court"" bởi God Host.",
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }
}

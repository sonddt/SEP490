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

public class MatchingControllerReopenPostTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
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
            // Unauthenticated
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
    public async Task ReopenPost_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.ReopenPost(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task ReopenPost_ShouldReturnNotFound_WhenHostDoesnNotOwnPostOrPostGhosted()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var alienPostId = Guid.NewGuid();

        // Foreign Post
        db.MatchingPosts.Add(new MatchingPost { Id = alienPostId, CreatorUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.ReopenPost(alienPostId);
        var bad = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE CHECKS ON ENDPOINTS (Status Lockdown)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task ReopenPost_ShouldReturnBadRequest_WhenPostIsNotStrictlyClosed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var inactiveId = Guid.NewGuid();
        var openId = Guid.NewGuid();
        var fullId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = inactiveId, CreatorUserId = myUserId, Status = "INACTIVE" });
        db.MatchingPosts.Add(new MatchingPost { Id = openId, CreatorUserId = myUserId, Status = "OPEN" });
        db.MatchingPosts.Add(new MatchingPost { Id = fullId, CreatorUserId = myUserId, Status = "FULL" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        // Reopening is literally ONLY exclusively allowed for explicitly CLOSED posts. All other states = Bounce
        var resultInactive = await controller.ReopenPost(inactiveId);
        var badInactive = Assert.IsType<BadRequestObjectResult>(resultInactive);
        Assert.Contains("đã đóng", ReadPayload<ErrorMessageResponse>(badInactive.Value).Message.ToLowerInvariant());
        
        var resultOpen = await controller.ReopenPost(openId);
        var badOpen = Assert.IsType<BadRequestObjectResult>(resultOpen);
        Assert.Contains("trạng thái đã đóng", ReadPayload<ErrorMessageResponse>(badOpen.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - CAPACITY RESOLVERS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task ReopenPost_ShouldResolveToOpenState_WhenRoomStillExistsInPost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost 
        { 
            Id = postId, CreatorUserId = hostId, Status = "CLOSED", RequiredPlayers = 2 
        };
        // Array constraint: 2 Required + 1 Host = 3 Capacity. 
        // We only insert HOST (1), meaning 2 slots are heavily vacant!
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = hostId, PostId = postId });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: hostId);

        var result = await controller.ReopenPost(postId);
        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.Equal("OPEN", post.Status); // Post is openly receiving players!
        
        var data = ReadPayload<JsonElement>(ok.Value);
        Assert.Equal("OPEN", data.GetProperty("status").GetString());
    }

    [Fact]
    public async Task ReopenPost_ShouldResolveToFullState_WhenPlayersMaxedPriorToReopening()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost 
        { 
            Id = postId, CreatorUserId = hostId, Status = "CLOSED", RequiredPlayers = 1 
        };
        // Array constraint: 1 Required + 1 Host = 2 Capacity Max limit.
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = hostId, PostId = postId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), PostId = postId });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: hostId);

        var result = await controller.ReopenPost(postId);
        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.Equal("FULL", post.Status); // Status resolves instantly to fully locked because max size hit!
        
        var data = ReadPayload<JsonElement>(ok.Value);
        Assert.Equal("FULL", data.GetProperty("status").GetString());
        Assert.Contains("vẫn đủ người", data.GetProperty("message").GetString()!.ToLowerInvariant());
    }
}

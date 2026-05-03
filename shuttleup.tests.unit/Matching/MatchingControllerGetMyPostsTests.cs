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

public class MatchingControllerGetMyPostsTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        IMatchingPostActivityService? activityService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockActivity = activityService != null ? Mock.Get(activityService) : new Mock<IMatchingPostActivityService>();

        mockActivity.Setup(a => a.ApplyExpiredOpenAndFullToInactiveAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

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

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION / AUTHENTICATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyPosts_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetMyPosts();
        Assert.IsType<UnauthorizedResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA OWNERSHIP & PENDING REQUEST MAPPING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyPosts_ShouldReturnOnlyOwnedPosts_AndComputesMemberRequestsAccurately()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var strangerId = Guid.NewGuid();

        // 1. Target Post (Owned by user)
        var myPost = new MatchingPost { Id = Guid.NewGuid(), Title = "MY THREAD", CreatorUserId = ownerId, RequiredPlayers = 2, Status = "OPEN", CreatedAt = DateTime.UtcNow };
        
        // Simulating 1 Active Member already physically joined
        myPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = myPost.Id, UserId = Guid.NewGuid() });
        
        // Simulating 1 Pending Join Request (e.g., someone wants to join)
        myPost.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = myPost.Id, UserId = Guid.NewGuid(), Status = "PENDING" });
        db.MatchingPosts.Add(myPost);

        // 2. Extraneous Post (Owned by stranger)
        var strangerPost = new MatchingPost { Id = Guid.NewGuid(), Title = "STRANGER THREAD", CreatorUserId = strangerId };
        db.MatchingPosts.Add(strangerPost);

        await db.SaveChangesAsync();

        var mockActivity = new Mock<IMatchingPostActivityService>();
        var controller = CreateController(db, mockActivity.Object, ownerId);

        var result = await controller.GetMyPosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var resList = ReadPayload<List<JsonElement>>(ok.Value);
        
        // Ensure Pre-Fetch Activity Cycle fired
        mockActivity.Verify(a => a.ApplyExpiredOpenAndFullToInactiveAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Verify Data Separation
        Assert.Single(resList);
        var mappedPost = resList[0];

        Assert.Equal(myPost.Id.ToString(), mappedPost.GetProperty("id").GetString());
        Assert.Equal("MY THREAD", mappedPost.GetProperty("title").GetString());
        
        // Compute Check: 1 Active Member
        Assert.Equal(1, mappedPost.GetProperty("membersCount").GetInt32());
        // Compute Check: 1 Pending Request 
        Assert.Equal(1, mappedPost.GetProperty("pendingRequests").GetInt32());
        
        // Core Authority Bools
        Assert.True(mappedPost.GetProperty("isHost").GetBoolean());
        Assert.False(mappedPost.GetProperty("canRequestJoin").GetBoolean()); // Host technically can't request to join themselves
    }
}

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

public class MatchingControllerGetJoinedPostsTests
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
    public async Task GetJoinedPosts_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetJoinedPosts();
        Assert.IsType<UnauthorizedResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA OWNERSHIP & PENDING REQUEST MAPPING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetJoinedPosts_ShouldReturnOnlyForeignPostsUserHasJoined_IgnoringOwnedAndUnjoined()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        // 1. Post I own (Should NOT return)
        var myPost = new MatchingPost { Id = Guid.NewGuid(), Title = "MY THREAD", CreatorUserId = myUserId };
        // Even if I technically am a member of my own post!
        myPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = myPost.Id, UserId = myUserId });
        db.MatchingPosts.Add(myPost);

        // 2. Foreign Post I joined (Should return)
        var joinedForeignPost = new MatchingPost { Id = Guid.NewGuid(), Title = "GUEST THREAD", CreatorUserId = otherUserId };
        joinedForeignPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = joinedForeignPost.Id, UserId = myUserId });
        db.MatchingPosts.Add(joinedForeignPost);

        // 3. Foreign Post I merely requested to join but haven't been accepted (Should NOT return)
        var pendingForeignPost = new MatchingPost { Id = Guid.NewGuid(), Title = "PENDING THREAD", CreatorUserId = otherUserId };
        pendingForeignPost.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = pendingForeignPost.Id, UserId = myUserId, Status = "PENDING" });
        db.MatchingPosts.Add(pendingForeignPost);

        await db.SaveChangesAsync();

        var mockActivity = new Mock<IMatchingPostActivityService>();
        var controller = CreateController(db, mockActivity.Object, myUserId);

        var result = await controller.GetJoinedPosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var resList = ReadPayload<List<JsonElement>>(ok.Value);
        
        // Activity Sync triggers natively 
        mockActivity.Verify(a => a.ApplyExpiredOpenAndFullToInactiveAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Verify Strict Query Constraints
        Assert.Single(resList); // Only the `GUEST THREAD` makes the cut!
        var mappedPost = resList[0];

        Assert.Equal(joinedForeignPost.Id.ToString(), mappedPost.GetProperty("id").GetString());
        Assert.Equal("GUEST THREAD", mappedPost.GetProperty("title").GetString());
        
        // Ensure authority context dynamically evaluates user is NOT the host
        Assert.False(mappedPost.GetProperty("isHost").GetBoolean());
        Assert.True(mappedPost.GetProperty("isMember").GetBoolean());
        Assert.False(mappedPost.GetProperty("isPending").GetBoolean()); 
    }
}

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

public class MatchingControllerGetPostDetailTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        IMatchingPostActivityService? activityService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockActivity = activityService != null ? Mock.Get(activityService) : new Mock<IMatchingPostActivityService>();

        mockActivity.Setup(a => a.EnsurePostInactiveIfElapsedAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
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
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. DATA VALIDATION & AUTHENTICATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPostDetail_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetPostDetail(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task GetPostDetail_ShouldReturnNotFound_WhenPostDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: Guid.NewGuid()); // Random valid user

        var result = await controller.GetPostDetail(Guid.NewGuid());
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. PRIVILEGE MASKING & DATA ISOLATION (isHost vs isGuest)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPostDetail_ShouldLeakPendingRequests_WhenQueryingUserIsHost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var targetPostId = Guid.NewGuid();

        var post = new MatchingPost { Id = targetPostId, CreatorUserId = hostId, Status = "OPEN", Title = "TEST" };
        
        // Simulating a pending join request sitting idly
        post.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = targetPostId, Status = "PENDING", UserId = Guid.NewGuid() });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var mockActivity = new Mock<IMatchingPostActivityService>();
        var controller = CreateController(db, activityService: mockActivity.Object, loggedInUserId: hostId);

        var result = await controller.GetPostDetail(targetPostId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<JsonElement>(ok.Value);

        // Pre-query trigger fires flawlessly
        mockActivity.Verify(a => a.EnsurePostInactiveIfElapsedAsync(targetPostId, It.IsAny<CancellationToken>()), Times.Once);

        // Verify Host Metadata
        Assert.True(data.GetProperty("isHost").GetBoolean());
        
        // Hosts SHOULD see the entire pending requests array actively 
        var pendingArray = data.GetProperty("pendingRequests");
        Assert.Equal(JsonValueKind.Array, pendingArray.ValueKind);
        Assert.Equal(1, pendingArray.GetArrayLength());
    }
    
    [Fact]
    public async Task GetPostDetail_ShouldMaskPendingRequestsAsNull_WhenQueryingUserIsStranger()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var strangerId = Guid.NewGuid();
        var targetPostId = Guid.NewGuid();

        var post = new MatchingPost { Id = targetPostId, CreatorUserId = Guid.NewGuid(), Status = "OPEN", Title = "TEST" }; // Post owned by someone else!
        
        post.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = targetPostId, Status = "PENDING", UserId = Guid.NewGuid() });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: strangerId);

        var result = await controller.GetPostDetail(targetPostId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<JsonElement>(ok.Value);

        Assert.False(data.GetProperty("isHost").GetBoolean());
        
        // Standard players MUST NOT be allowed to read the arrays of who is waiting to join the post!
        Assert.Equal(JsonValueKind.Null, data.GetProperty("pendingRequests").ValueKind);
    }
    
    // ══════════════════════════════════════════════════════════
    // 3. COMPLEX JOIN MAPPINGS (COURT & BOOKING INFO)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPostDetail_ShouldMapBookingItemDetailsIntoUIArray()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var targetPostId = Guid.NewGuid();

        var post = new MatchingPost { Id = targetPostId, CreatorUserId = userId, Status = "OPEN", Title = "TEST" }; 
        var court = new Court { Id = Guid.NewGuid(), Name = "Alpha Court" };
        var bi = new BookingItem { Id = Guid.NewGuid(), Court = court, FinalPrice = 450000 };
        
        post.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), PostId = targetPostId, BookingItem = bi });
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: userId);

        var result = await controller.GetPostDetail(targetPostId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<JsonElement>(ok.Value);

        var bookingItemsArray = data.GetProperty("bookingItems");
        Assert.Equal(1, bookingItemsArray.GetArrayLength());
        
        var node = bookingItemsArray[0];
        Assert.Equal("Alpha Court", node.GetProperty("courtName").GetString());
        Assert.Equal(450000m, node.GetProperty("price").GetDecimal());
    }
}

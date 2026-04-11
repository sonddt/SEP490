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

public class MatchingControllerCancelJoinRequestTests
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
    public async Task CancelJoinRequest_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.CancelJoinRequest(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task CancelJoinRequest_ShouldReturnNotFound_WhenRequestIsMissingAlreadyResolvedOrForeign()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var alienUserId = Guid.NewGuid();
        
        var missingRequestId = Guid.NewGuid();  // Doesn't exist
        var alienPostId = Guid.NewGuid();       // Exists, but alien requests it
        var resolvedPostId = Guid.NewGuid();    // Exists, mine, but already accepted

        // 1. Alien owns the request
        db.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = alienPostId, UserId = alienUserId, Status = "PENDING" });
        
        // 2. Mine, but unfortunately already resolved by host (Too late to cancel!)
        db.MatchingJoinRequests.Add(new MatchingJoinRequest { Id = Guid.NewGuid(), PostId = resolvedPostId, UserId = myUserId, Status = "ACCEPTED" });

        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var r1 = await controller.CancelJoinRequest(missingRequestId);
        Assert.Contains("không có yêu cầu", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)r1).Value).Message.ToLowerInvariant());

        var r2 = await controller.CancelJoinRequest(alienPostId);
        Assert.Contains("không có yêu cầu", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)r2).Value).Message.ToLowerInvariant());
        
        var r3 = await controller.CancelJoinRequest(resolvedPostId);
        Assert.Contains("không có yêu cầu", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)r3).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. HAPPY PATH 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelJoinRequest_ShouldUpdateStatusToCancelled_WhenSuccessfullyLocatingValidPendingRequest()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var targetPostId = Guid.NewGuid();

        var joinReq = new MatchingJoinRequest 
        { 
            Id = Guid.NewGuid(), 
            PostId = targetPostId, 
            UserId = myUserId, 
            Status = "PENDING" 
        };
        db.MatchingJoinRequests.Add(joinReq);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.CancelJoinRequest(targetPostId);
        Assert.IsType<OkObjectResult>(result);

        // Core Assertion -> DB Model mutated dynamically preserving its historical block
        Assert.Equal("CANCELLED", joinReq.Status);
    }
}

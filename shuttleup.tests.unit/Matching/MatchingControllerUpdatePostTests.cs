using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.MatchingController;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerUpdatePostTests
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
    public async Task UpdatePost_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.UpdatePost(Guid.NewGuid(), new UpdatePostDto());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task UpdatePost_ShouldReturnNotFound_WhenAccessingForeignOrGhostPost()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var targetId = Guid.NewGuid();

        // Database inserts post owned by entirely different player
        db.MatchingPosts.Add(new MatchingPost { Id = targetId, CreatorUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.UpdatePost(targetId, new UpdatePostDto());
        var bad = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE METASTATE VALIDATIONS (STATUS LOCKDOWN)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdatePost_ShouldReturnBadRequest_WhenPostIsNotStrictlyOpen()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var inactivePostId = Guid.NewGuid();
        var fullPostId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = inactivePostId, CreatorUserId = myUserId, Status = "INACTIVE" });
        db.MatchingPosts.Add(new MatchingPost { Id = fullPostId, CreatorUserId = myUserId, Status = "FULL" }); // Full posts are locked!
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var resultInactive = await controller.UpdatePost(inactivePostId, new UpdatePostDto());
        var badInactive = Assert.IsType<BadRequestObjectResult>(resultInactive);
        Assert.Contains("đã kết thúc", ReadPayload<ErrorMessageResponse>(badInactive.Value).Message.ToLowerInvariant());

        var resultFull = await controller.UpdatePost(fullPostId, new UpdatePostDto());
        var badFull = Assert.IsType<BadRequestObjectResult>(resultFull);
        Assert.Contains("trạng thái đang mở", ReadPayload<ErrorMessageResponse>(badFull.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. CAPACITANCE PARADOX CHECKS (PLAYER SLOTS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdatePost_ShouldReturnBadRequest_WhenShrinkingPlayersBelowCurrentMembership()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = myUserId, Status = "OPEN", RequiredPlayers = 4 };
        // Insert 3 total players (1 host + 2 guests)
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = myUserId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = Guid.NewGuid() });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), UserId = Guid.NewGuid() });
        
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        // ATTEMPT 1: Shrink to 0 (Violates core constraint MIN 1)
        var resultZero = await controller.UpdatePost(postId, new UpdatePostDto { RequiredPlayers = 0 });
        Assert.Contains("ít nhất là 1", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resultZero).Value).Message.ToLowerInvariant());

        // ATTEMPT 2: Shrink requirement to 1. (1 Required + 1 Host = Max 2 slots. But there are currently 3 people!)
        var resultParadox = await controller.UpdatePost(postId, new UpdatePostDto { RequiredPlayers = 1 });
        var parad = Assert.IsType<BadRequestObjectResult>(resultParadox);
        Assert.Contains("nhỏ hơn số thành viên hiện có", ReadPayload<ErrorMessageResponse>(parad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH (PARTIAL UPDATES)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdatePost_ShouldApplyPartialUpdates_WhenRulesAreMet()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        var post = new MatchingPost 
        { 
            Id = postId, 
            CreatorUserId = myUserId, 
            Status = "OPEN", 
            RequiredPlayers = 2,
            Title = "Original",
            Notes = "Bring cash"
        };
        db.MatchingPosts.Add(post);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var dto = new UpdatePostDto 
        { 
            RequiredPlayers = 4, // Successfully raising limit perfectly legal
            Title = "Updated Setup",
            Notes = null // Leaving fields null means "Do NOT update"
        };
        
        var result = await controller.UpdatePost(postId, dto);
        Assert.IsType<OkObjectResult>(result);

        // Verification
        Assert.Equal("Updated Setup", post.Title);
        Assert.Equal(4, post.RequiredPlayers);
        Assert.Equal("Bring cash", post.Notes); // Undisturbed natively
    }
}

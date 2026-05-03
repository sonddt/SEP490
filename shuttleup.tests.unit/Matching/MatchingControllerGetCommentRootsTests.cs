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

public class MatchingControllerGetCommentRootsTests
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
    
    private class PagedResponse
    {
        public int Total { get; set; }
        public int TotalAll { get; set; }
        public List<JsonElement> Items { get; set; } = new();
    }

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & PRIVILEGE CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCommentRoots_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetCommentRoots(Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task GetCommentRoots_ShouldReturnForbid_WhenNonMemberAttemptsToViewPrivateDiscussion()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() }); // Active Post
        // No MatchingMembers array bindings instantiated! Alien is physically outside the group.
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: alienUserId);

        var result = await controller.GetCommentRoots(postId);
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. HAPPY PATH & COMPLEX MAPPING LOGIC (Popular Sort / Soft Deletions)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCommentRoots_ShouldCalculateReplyCountsIgnoreDeletionsAndApplyPopularSortProperly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        db.Users.Add(new User { Id = memberId, FullName = "Hieu The Member" });

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        db.MatchingPosts.Add(post);

        // --- Comment Structure Setup ---
        
        // Root 1: Very active with 2 valid replies, created EARLY!
        var r1 = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = memberId, User = new User { Id = Guid.NewGuid() }, CreatedAt = DateTime.UtcNow.AddMinutes(-10), IsDeleted = false, ParentCommentId = null };
        var replyA = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = r1.Id, IsDeleted = false };
        var replyB = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = r1.Id, IsDeleted = false };
        // Soft Deleted reply (Must be excluded from count!)
        var replyDeleted = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, ParentCommentId = r1.Id, IsDeleted = true };
        
        // Root 2: No replies, but created RECENTLY!
        var r2 = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = memberId, User = new User { Id = Guid.NewGuid() }, CreatedAt = DateTime.UtcNow.AddMinutes(-5), IsDeleted = false, ParentCommentId = null };

        // Root 3: Entire thread was soft deleted (Should be completely missing from View)
        var r3Deleted = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = memberId, User = new User { Id = Guid.NewGuid() }, CreatedAt = DateTime.UtcNow, IsDeleted = true, ParentCommentId = null };

        db.MatchingPostComments.AddRange(r1, replyA, replyB, replyDeleted, r2, r3Deleted);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Execution Check: Sort by 'popular'. Under this criteria:
        // Root 1 has 2 valid replies (r3 doesn't count) -> Should be FIRST
        // Root 2 has 0 replies -> Should be SECOND (even if its Date is newer!)
        var result = await controller.GetCommentRoots(postId, sort: "popular");
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<PagedResponse>(ok.Value);

        // Core Aggregate Verification
        Assert.Equal(2, data.Total); // Only r1 and r2 exist actively as roots! r3 is purged.
        Assert.Equal(4, data.TotalAll); // 2 Roots + 2 Replies (replyA, replyB). 

        // Ordered Matrix Verification
        var firstElement = data.Items[0];
        Assert.Equal(r1.Id.ToString(), firstElement.GetProperty("id").GetString());
        Assert.Equal(2, firstElement.GetProperty("replyCount").GetInt32()); // Precisely counted the valid nested branch
    }
}

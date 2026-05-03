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

public class MatchingControllerGetCommentRepliesTests
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
        public List<JsonElement> Items { get; set; } = new();
    }
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }


    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & PRIVILEGE CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCommentReplies_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetCommentReplies(Guid.NewGuid(), Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task GetCommentReplies_ShouldReturnForbid_WhenNonMemberAttemptsToRead()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() }); // Active Post
        // No MatchingMembers array bindings instantiated! Alien is entirely physically outside the group.
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: alienUserId);

        var result = await controller.GetCommentReplies(postId, Guid.NewGuid());
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. PARENT METASTATE CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCommentReplies_ShouldReturnNotFound_WhenRootIsDeletedMissingOrNotActuallyARoot()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        db.MatchingPosts.Add(post);

        // Scenario A: Soft Deleted Root
        var deletedRoot = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, IsDeleted = true, ParentCommentId = null };
        
        // Scenario B: Not a Root at all (a user tries to fetch replies from a child node generating endless loops)
        var parentRoot = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, IsDeleted = false, ParentCommentId = null };
        var childNode = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, IsDeleted = false, ParentCommentId = parentRoot.Id };

        db.MatchingPostComments.AddRange(deletedRoot, parentRoot, childNode);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Execute Against Scene A
        var r1 = await controller.GetCommentReplies(postId, deletedRoot.Id);
        var bad1 = Assert.IsType<NotFoundObjectResult>(r1);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad1.Value).Message.ToLowerInvariant());

        // Execute Against Scene B
        var r2 = await controller.GetCommentReplies(postId, childNode.Id);
        var bad2 = Assert.IsType<NotFoundObjectResult>(r2);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad2.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - CHILDREN RESOLVER MAP
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCommentReplies_ShouldLoadChildrenAndResolveParentFullName_WhileExcludingDeletedChunks()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid(); 
        var postId = Guid.NewGuid();
        var authorId = Guid.NewGuid();

        db.Users.Add(new User { Id = memberId, FullName = "Querying Member" });
        db.Users.Add(new User { Id = authorId, FullName = "Hieu The Author" });

        var post = new MatchingPost { Id = postId, CreatorUserId = memberId };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = memberId });
        db.MatchingPosts.Add(post);

        // Core Root Context
        var root = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = authorId, IsDeleted = false, ParentCommentId = null };

        // Valid Child
        var childA = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = memberId, IsDeleted = false, ParentCommentId = root.Id, Content = "Great point!" };
        
        // Deleted Child
        var childGhost = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = memberId, IsDeleted = true, ParentCommentId = root.Id, Content = "Nevermind." };

        db.MatchingPostComments.AddRange(root, childA, childGhost);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var result = await controller.GetCommentReplies(postId, root.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<PagedResponse>(ok.Value);

        // Capacitance Asserts: Must drop the ghost child cleanly!
        Assert.Equal(1, data.Total);
        var outputNode = data.Items[0];

        // Ensure string logic maps exact User content 
        Assert.Equal("Great point!", outputNode.GetProperty("content").GetString());
        
        // Relational Parent Join Matrix - Ensure it pulls the author's real full name down to display 'Replying to...' UI text
        Assert.Equal("Hieu The Author", outputNode.GetProperty("replyToFullName").GetString());
    }
}

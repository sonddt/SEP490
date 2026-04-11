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

public class MatchingControllerSoftDeleteCommentTests
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
    // 1. ISOLATION & GROUP BOUNDARIES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SoftDeleteComment_ShouldReturnUnauthorizedOrForbid_WhenBaseConstraintsViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        db.MatchingPosts.Add(new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() });
        // No group membership granted!
        await db.SaveChangesAsync();

        // 1. Anonymous Access
        var controllerAnon = CreateController(db, loggedInUserId: null);
        var rAnon = await controllerAnon.SoftDeleteComment(postId, Guid.NewGuid());
        Assert.IsType<UnauthorizedResult>(rAnon);

        // 2. Extraneous Alien Actor
        var controllerAlien = CreateController(db, loggedInUserId: alienUserId);
        var rAlien = await controllerAlien.SoftDeleteComment(postId, Guid.NewGuid());
        Assert.IsType<ForbidResult>(rAlien);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE LOCK AND STRUCT IDEMPOTENCY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SoftDeleteComment_ShouldBlockInactivePostsAndIdempotentlyReturnOkOnRepeats()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var activePostId = Guid.NewGuid();
        var inactivePostId = Guid.NewGuid();

        // Post Setups
        var activePost = new MatchingPost { Id = activePostId, CreatorUserId = memberId, Status = "OPEN" };
        activePost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = activePostId, UserId = memberId });
        var inactivePost = new MatchingPost { Id = inactivePostId, CreatorUserId = memberId, Status = "INACTIVE" };
        inactivePost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = inactivePostId, UserId = memberId });

        // Database Comment Trace
        var alreadyDeletedComment = new MatchingPostComment { Id = Guid.NewGuid(), PostId = activePostId, UserId = memberId, IsDeleted = true };

        db.MatchingPosts.AddRange(activePost, inactivePost);
        db.MatchingPostComments.Add(alreadyDeletedComment);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Matrix Trap 1: Inactive Post
        var r1 = await controller.SoftDeleteComment(inactivePostId, Guid.NewGuid());
        Assert.Contains("kết thúc", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        // Matrix Trap 2: Missing Node
        var r2 = await controller.SoftDeleteComment(activePostId, Guid.NewGuid());
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)r2).Value).Message.ToLowerInvariant());

        // Matrix Trap 3: Ghost Node (Already Deleted) must safely bypass cleanly as IDEMPOTENT HTTP OK!
        var r3 = await controller.SoftDeleteComment(activePostId, alreadyDeletedComment.Id);
        var ok = Assert.IsType<OkObjectResult>(r3);
        Assert.Contains("gỡ trước đó", ReadPayload<ErrorMessageResponse>(ok.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. INTERNAL PRIVILEGE (HOST OVERRIDE VS PEER DENIAL)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SoftDeleteComment_ShouldAllowHostOrAuthorToDelete_WhileBlockingRandomPeers()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var peerId = Guid.NewGuid();
        var postId = Guid.NewGuid();

        // 3 separate players mapping to the SAME active thread!
        var post = new MatchingPost { Id = postId, CreatorUserId = hostId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = hostId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = authorId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = peerId });
        db.MatchingPosts.Add(post);

        // Construct 2 vulnerable comment nodes
        var commentA = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = authorId, IsDeleted = false };
        var commentB = new MatchingPostComment { Id = Guid.NewGuid(), PostId = postId, UserId = authorId, IsDeleted = false };
        db.MatchingPostComments.AddRange(commentA, commentB);
        await db.SaveChangesAsync();

        // Action 1: A random Peer maliciously tries to delete the Author's comment natively
        var controllerPeer = CreateController(db, loggedInUserId: peerId);
        var resForbid = await controllerPeer.SoftDeleteComment(postId, commentA.Id);
        Assert.IsType<ForbidResult>(resForbid); // Interception successful because Peer neither wrote it nor hosts the room!

        // Action 2: The Author successfully deletes their OWN comment
        var controllerAuthor = CreateController(db, loggedInUserId: authorId);
        var resOk1 = await controllerAuthor.SoftDeleteComment(postId, commentA.Id);
        Assert.IsType<OkObjectResult>(resOk1);
        Assert.True(commentA.IsDeleted);
        Assert.Equal(authorId, commentA.DeletedByUserId);

        // Action 3: The HOST executes an administrative delete over the Author's remaining comment!
        var controllerHost = CreateController(db, loggedInUserId: hostId);
        var resOk2 = await controllerHost.SoftDeleteComment(postId, commentB.Id);
        Assert.IsType<OkObjectResult>(resOk2);
        Assert.True(commentB.IsDeleted);
        Assert.Equal(hostId, commentB.DeletedByUserId); // Core tracking telemetry validation correctly mapping the Admin!
    }
}

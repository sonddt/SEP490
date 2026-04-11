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

public class MatchingControllerEditCommentTests
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
    // 1. ISOLATION, GROUP BINDS, & AUTHORSHIP CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchComment_ShouldReturnUnauthorizedOrForbid_WhenAccessOwnershipConstraintsAreViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var authorId = Guid.NewGuid();
        var maliciousColleagueId = Guid.NewGuid(); // Also in the group!
        var completelyAlienId = Guid.NewGuid();   // Not in the group at all!
        var postId = Guid.NewGuid();
        var commentId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = Guid.NewGuid() };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = authorId });
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = maliciousColleagueId }); // In Group.
        
        var comment = new MatchingPostComment { Id = commentId, PostId = postId, UserId = authorId }; // Owned by author.

        db.MatchingPosts.Add(post);
        db.MatchingPostComments.Add(comment);
        await db.SaveChangesAsync();

        // 1. Unauthenticated completely
        var controllerAnon = CreateController(db, loggedInUserId: null);
        var rAnon = await controllerAnon.PatchComment(postId, commentId, new CommentDto());
        Assert.IsType<UnauthorizedResult>(rAnon);

        // 2. Alien - Not inside `.MatchingMembers` array!
        var controllerAlien = CreateController(db, loggedInUserId: completelyAlienId);
        var rAlien = await controllerAlien.PatchComment(postId, commentId, new CommentDto());
        Assert.IsType<ForbidResult>(rAlien); // Group-level isolation failure

        // 3. Colleague - Inside group, BUT trying to edit physical data of `authorId`!
        var controllerColleague = CreateController(db, loggedInUserId: maliciousColleagueId);
        var rColleague = await controllerColleague.PatchComment(postId, commentId, new CommentDto());
        Assert.IsType<ForbidResult>(rColleague); // Ownership-level isolation failure
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE & STATE METRICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchComment_ShouldReturnBadRequest_WhenPostIsInactiveOrCommentIsDeleted()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var authorId = Guid.NewGuid();
        var inactivePostId = Guid.NewGuid();
        var activePostId = Guid.NewGuid();

        var inactivePost = new MatchingPost { Id = inactivePostId, CreatorUserId = authorId, Status = "INACTIVE" };
        inactivePost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = inactivePostId, UserId = authorId });
        
        var editOnInactive = new MatchingPostComment { Id = Guid.NewGuid(), PostId = inactivePostId, UserId = authorId };

        var openPost = new MatchingPost { Id = activePostId, CreatorUserId = authorId, Status = "OPEN" };
        openPost.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = activePostId, UserId = authorId });
        
        var alreadyDeleted = new MatchingPostComment { Id = Guid.NewGuid(), PostId = activePostId, UserId = authorId, IsDeleted = true }; // Deleted items CANNOT be edited.

        db.MatchingPosts.Add(inactivePost);
        db.MatchingPosts.Add(openPost);
        db.MatchingPostComments.Add(editOnInactive);
        db.MatchingPostComments.Add(alreadyDeleted);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: authorId);

        // State test A: Inactive timeline
        var r1 = await controller.PatchComment(inactivePostId, editOnInactive.Id, new CommentDto());
        Assert.Contains("đã kết thúc", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        // State test B: Soft deleted state locking
        var r2 = await controller.PatchComment(activePostId, alreadyDeleted.Id, new CommentDto());
        Assert.Contains("đã được gỡ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. PHYSICAL VALIDATION ERRORS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchComment_ShouldReturnBadRequest_WhenContentIsNullWithNoAttachmentOrExceedsMaxBounds()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var authorId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var commentId = Guid.NewGuid();

        var post = new MatchingPost { Id = postId, CreatorUserId = authorId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = authorId });
        // NOTE: No attachment configured physically on the DB record for this comment!
        var comment = new MatchingPostComment { Id = commentId, PostId = postId, UserId = authorId }; 

        db.MatchingPosts.Add(post);
        db.MatchingPostComments.Add(comment);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: authorId);

        // Trap 1: Empty string overriding current string! (Should fail because no attachment exists to float the UI footprint)
        var dtoEmpty = new CommentDto { Content = "   " };
        var r1 = await controller.PatchComment(postId, commentId, dtoEmpty);
        Assert.Contains("nhập nội dung hoặc giữ ảnh", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        // Trap 2: Payload overflow!
        var charArr = new char[2001];
        Array.Fill(charArr, 'A');
        var dtoMassive = new CommentDto { Content = new string(charArr) };
        var r2 = await controller.PatchComment(postId, commentId, dtoMassive);
        Assert.Contains("tối đa 2000 ký tự", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH - UPDATED ENTITY MAPPING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchComment_ShouldPhysicallyMutateContentAndUpdateTimestamps_WhenPassedCorrectly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var authorId = Guid.NewGuid();
        var postId = Guid.NewGuid();
        var commentId = Guid.NewGuid();

        // Injecting user strictly for `.FirstAsync(c => c.Id == commentId)` string mappings!
        db.Users.Add(new User { Id = authorId, FullName = "Hieu The Editor" });

        var post = new MatchingPost { Id = postId, CreatorUserId = authorId, Status = "OPEN" };
        post.MatchingMembers.Add(new MatchingMember { Id = Guid.NewGuid(), PostId = postId, UserId = authorId });
        var comment = new MatchingPostComment { Id = commentId, PostId = postId, UserId = authorId, Content = "Original Message", CreatedAt = DateTime.UtcNow }; 

        db.MatchingPosts.Add(post);
        db.MatchingPostComments.Add(comment);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: authorId);

        var result = await controller.PatchComment(postId, commentId, new CommentDto { Content = "I have reconsidered." });
        var ok = Assert.IsType<OkObjectResult>(result);

        // Struct Asserts!
        Assert.Equal("I have reconsidered.", comment.Content);
        Assert.NotNull(comment.UpdatedAt); // Ensure Edit flag triggers implicitly

        var responsePayload = ReadPayload<JsonElement>(ok.Value);
        Assert.True(responsePayload.GetProperty("isEdited").GetBoolean());
        Assert.Equal("Hieu The Editor", responsePayload.GetProperty("fullName").GetString());
    }
}

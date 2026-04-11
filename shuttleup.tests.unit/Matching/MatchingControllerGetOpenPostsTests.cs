using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerGetOpenPostsTests
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

    private class GetOpenPostsResponse
    {
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public List<JsonElement> Items { get; set; } = new();
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
    public async Task GetOpenPosts_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetOpenPosts(null, null, null, null, null);
        Assert.IsType<UnauthorizedResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE ELIGIBILITY FILTERING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetOpenPosts_ShouldFilterOutPastPostsAndInactivePosts()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        // 1. Valid Post (Future StartTime, Status OPEN)
        var p1 = new MatchingPost { Id = Guid.NewGuid(), Status = "OPEN", CreatorUserId = userId };
        var bi1 = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(2) };
        p1.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = bi1 });
        db.MatchingPosts.Add(p1);

        // 2. Valid Post (Future StartTime, Status FULL)
        var p2 = new MatchingPost { Id = Guid.NewGuid(), Status = "FULL", CreatorUserId = userId };
        var bi2 = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(2) };
        p2.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = bi2 });
        db.MatchingPosts.Add(p2);

        // 3. Invalid Post (Future StartTime, Status INACTIVE)
        var p3 = new MatchingPost { Id = Guid.NewGuid(), Status = "INACTIVE", CreatorUserId = userId };
        var bi3 = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(2) };
        p3.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = bi3 });
        db.MatchingPosts.Add(p3);

        // 4. Invalid Post (Past StartTime, Status OPEN)
        var p4 = new MatchingPost { Id = Guid.NewGuid(), Status = "OPEN", CreatorUserId = userId };
        var bi4 = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(-2) };
        p4.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = bi4 });
        db.MatchingPosts.Add(p4);

        await db.SaveChangesAsync();

        var mockActivity = new Mock<IMatchingPostActivityService>();
        var controller = CreateController(db, mockActivity.Object, userId);

        var result = await controller.GetOpenPosts(null, null, null, null, null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resObj = ReadPayload<GetOpenPostsResponse>(ok.Value);
        
        // Assert execution of pre-sync tracking
        mockActivity.Verify(a => a.ApplyExpiredOpenAndFullToInactiveAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Verify only p1 and p2 dropped through
        Assert.Equal(2, resObj.Total);
        var returnedIds = resObj.Items.Select(i => Guid.Parse(i.GetProperty("id").GetString()!)).ToList();
        Assert.Contains(p1.Id, returnedIds);
        Assert.Contains(p2.Id, returnedIds);
    }

    // ══════════════════════════════════════════════════════════
    // 3. ADVANCED SEARCH QUERIES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetOpenPosts_ShouldFilterBySearchQueryAndSkillOrProvince()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        // Target matching both criteria
        var p1 = new MatchingPost 
        { 
            Id = Guid.NewGuid(), Status = "OPEN", CreatorUserId = userId,
            Title = "Morning session", SkillLevel = "PRO", Venue = new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), Address = "Quận 1, HCM" }
        };
        p1.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(1) } });
        db.MatchingPosts.Add(p1);

        // Doesn't match SkillLevel
        var p2 = new MatchingPost 
        { 
            Id = Guid.NewGuid(), Status = "OPEN", CreatorUserId = userId,
            Title = "Afternoon game", SkillLevel = "BEGINNER", Venue = new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), Address = "Quận 2, HCM" }
        };
        p2.MatchingPostItems.Add(new MatchingPostItem { Id = Guid.NewGuid(), BookingItem = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(1) } });
        db.MatchingPosts.Add(p2);

        await db.SaveChangesAsync();

        var controller = CreateController(db, null, userId);

        // Search term = 'morning', skill = 'PRO' -> Expect Match P1
        var result1 = await controller.GetOpenPosts(skillLevel: "PRO", province: null, playDate: null, sort: null, q: "morning");
        var res1 = ReadPayload<GetOpenPostsResponse>(((OkObjectResult)result1).Value);
        Assert.Single(res1.Items);
        Assert.Equal(p1.Id.ToString(), res1.Items[0].GetProperty("id").GetString());

        // Search province exact string = 'Quận 2' -> Expect Match P2
        var result2 = await controller.GetOpenPosts(skillLevel: null, province: "Quận 2", playDate: null, sort: null, q: null);
        var res2 = ReadPayload<GetOpenPostsResponse>(((OkObjectResult)result2).Value);
        Assert.Single(res2.Items);
        Assert.Equal(p2.Id.ToString(), res2.Items[0].GetProperty("id").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 4. SORTING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetOpenPosts_ShouldPrioritizeSortingProperly_ByPriceAsc()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        // Add 3 variants out of order natively
        db.MatchingPosts.Add(CreateValidPost(db, 300));
        db.MatchingPosts.Add(CreateValidPost(db, 100));
        db.MatchingPosts.Add(CreateValidPost(db, 200));
        await db.SaveChangesAsync();

        var controller = CreateController(db, null, userId);

        var result = await controller.GetOpenPosts(null, null, null, sort: "price_asc", null);
        
        var resObj = ReadPayload<GetOpenPostsResponse>(((OkObjectResult)result).Value);
        
        Assert.Equal(3, resObj.Total);
        Assert.Equal(100m, resObj.Items[0].GetProperty("pricePerSlot").GetDecimal());
        Assert.Equal(200m, resObj.Items[1].GetProperty("pricePerSlot").GetDecimal());
        Assert.Equal(300m, resObj.Items[2].GetProperty("pricePerSlot").GetDecimal());
    }

    private static MatchingPost CreateValidPost(ShuttleUpDbContext db, decimal price)
    {
        var post = new MatchingPost 
        { 
            Id = Guid.NewGuid(), Status = "OPEN", CreatorUserId = Guid.NewGuid(), 
            PricePerSlot = price 
        };
        post.MatchingPostItems.Add(new MatchingPostItem 
        { 
            Id = Guid.NewGuid(), BookingItem = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.Now.AddDays(1) } 
        });
        return post;
    }
}

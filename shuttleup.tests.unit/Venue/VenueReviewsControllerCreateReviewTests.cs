using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class VenueReviewsControllerCreateReviewTests
{
    private VenueReviewsController CreateController(
        ShuttleUpDbContext dbContext,
        IVenueReviewService? reviewService = null,
        IFileService? fileService = null,
        INotificationDispatchService? notifyService = null,
        Guid? loggedInUserId = null,
        bool simulateInvalidModelState = false)
    {
        var mockReview = reviewService != null ? Mock.Get(reviewService) : new Mock<IVenueReviewService>();
        var mockFile = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();

        var controller = new VenueReviewsController(
            mockReview.Object,
            mockFile.Object,
            dbContext,
            mockNotify.Object
        );

        if (simulateInvalidModelState)
        {
            controller.ModelState.AddModelError("Stars", "Stars are required.");
        }

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
            // Fully unauthenticated OR corrupted token without ID
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA VALIDATION & AUTHENTICATION PROTOCOLS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreateReview_ShouldReturnBadRequest_WhenModelStateIsBroken()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, simulateInvalidModelState: true);

        var result = await controller.CreateReview(Guid.NewGuid(), new CreateReviewRequestDto());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateReview_ShouldReturnUnauthorized_WhenTokenPipesBlankId()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        // Null user logged in -> drops past the [Authorize] but crashes inside TryGetUserId internal check
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.CreateReview(Guid.NewGuid(), new CreateReviewRequestDto());
        
        var unauth = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Contains("không hợp lệ", ReadPayload<ErrorMessageResponse>(unauth.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task CreateReview_ShouldReturnConflict_WhenServiceFailsEligibilityCheck()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var mockService = new Mock<IVenueReviewService>();
        // Simulate "User already reviewed" or "No eligible booking" which raises InvalidOperationException internally.
        mockService.Setup(s => s.CreateReviewAsync(venueId, userId, It.IsAny<CreateReviewRequestDto>()))
            .ThrowsAsync(new InvalidOperationException("BẠN KHÔNG CÓ ĐƠN ĐẶT NÀO ĐỂ ĐÁNH GIÁ."));

        var controller = CreateController(db, reviewService: mockService.Object, loggedInUserId: userId);

        var result = await controller.CreateReview(venueId, new CreateReviewRequestDto());
        
        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("đơn đặt nào", ReadPayload<ErrorMessageResponse>(conflict.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. HAPPY PATH & NOTIFICATION DISPATCH CHAIN
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreateReview_ShouldSaveSuccessfullyAndBypassNotification_WhenNoOwnerExistsOrUserIsOwner()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid(); // Mocks the "Self-review" edge case or missing owner logic
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var returnedDto = new VenueReviewDto { Id = Guid.NewGuid(), Stars = 5 };

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.CreateReviewAsync(venueId, managerId, It.IsAny<CreateReviewRequestDto>()))
            .ReturnsAsync(returnedDto);

        var mockNotify = new Mock<INotificationDispatchService>();

        var controller = CreateController(db, reviewService: mockService.Object, notifyService: mockNotify.Object, loggedInUserId: managerId);

        var dto = new CreateReviewRequestDto { Stars = 5, Comment = "Self check" };
        var result = await controller.CreateReview(venueId, dto);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal("GetReviews", created.ActionName);

        // Verification ensures self-pinging is disabled!
        mockNotify.Verify(n => n.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<NotificationTypes>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), false, It.IsAny<CancellationToken>()), 
            Times.Never);
    }

    [Fact]
    public async Task CreateReview_ShouldSaveSuccessfullyAndDispatchNotification_WhenRegularPlayerReviews()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueOwnerId = Guid.NewGuid(); 
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = venueOwnerId });
        db.Users.Add(new User { Id = playerId, FullName = "Nguyễn Đạt Nhất" }); // Populate full name
        await db.SaveChangesAsync();

        var returnedDto = new VenueReviewDto { Id = Guid.NewGuid(), Stars = 4 };

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.CreateReviewAsync(venueId, playerId, It.IsAny<CreateReviewRequestDto>()))
            .ReturnsAsync(returnedDto);

        var mockNotify = new Mock<INotificationDispatchService>();
        
        var controller = CreateController(db, reviewService: mockService.Object, notifyService: mockNotify.Object, loggedInUserId: playerId);

        var dto = new CreateReviewRequestDto { Stars = 4, Comment = "Good lighting" };
        var result = await controller.CreateReview(venueId, dto);

        Assert.IsType<CreatedAtActionResult>(result);

        // Crucial Assertions on Notification Side-Effects
        mockNotify.Verify(n => n.NotifyUserAsync(
            venueOwnerId, // Explicitly target the manager
            NotificationTypes.VenueReviewNew, // System Enum mapped properly
            "Có đánh giá mới tại sân", // Correct routing title mapped directly over sockets
            "Nguyễn Đạt Nhất vừa đánh giá 4 sao.", // Text substitution processed the "Stars" value!
            It.IsAny<object>(), // Deep link dynamically embedded
            false, 
            It.IsAny<CancellationToken>()), 
            Times.Once);
    }
    
    [Fact]
    public async Task CreateReview_ShouldSaveSuccessfullyAndDispatchNotificationDefaultingToGuest_WhenUserIsMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueOwnerId = Guid.NewGuid(); 
        var ghostId = Guid.NewGuid(); // User record purposefully not injected into DB
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = venueOwnerId });
        await db.SaveChangesAsync();

        var returnedDto = new VenueReviewDto { Id = Guid.NewGuid(), Stars = 5 };

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.CreateReviewAsync(venueId, ghostId, It.IsAny<CreateReviewRequestDto>()))
            .ReturnsAsync(returnedDto);

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, reviewService: mockService.Object, notifyService: mockNotify.Object, loggedInUserId: ghostId);

        var result = await controller.CreateReview(venueId, new CreateReviewRequestDto { Stars = 5 });

        Assert.IsType<CreatedAtActionResult>(result);

        // Verification Fallback (Null string substitution check)
        mockNotify.Verify(n => n.NotifyUserAsync(
            venueOwnerId, 
            NotificationTypes.VenueReviewNew, 
            It.IsAny<string>(), 
            "Người chơi vừa đánh giá 5 sao.", // Defaulted to safe placeholder!
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), 
            Times.Once);
    }
}

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Review;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class VenueReviewsControllerUpdateReviewTests
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
            controller.ModelState.AddModelError("Stars", "Stars must be between 1 and 5.");
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
            // Unauthenticated
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
    // 1. DATA VALIDATION & AUTHENTICATION SECRECY 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateReview_ShouldReturnBadRequest_WhenModelStateIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, simulateInvalidModelState: true);

        var result = await controller.UpdateReview(Guid.NewGuid(), Guid.NewGuid(), new UpdateReviewRequestDto());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateReview_ShouldReturnUnauthorized_WhenTokenPipesBlankId()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        // Null user logged in -> drops past the [Authorize] filter but crashes inside TryGetUserId internally
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.UpdateReview(Guid.NewGuid(), Guid.NewGuid(), new UpdateReviewRequestDto());
        
        var unauth = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Contains("không hợp lệ", ReadPayload<ErrorMessageResponse>(unauth.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE WINDOW AND OWNERSHIP EXCEPTIONS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateReview_ShouldReturnConflict_WhenServiceWindowExpiredOrOwnershipViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();

        var mockService = new Mock<IVenueReviewService>();
        // Simulate "Edit window expired (past 3 days)" or "Review doesn't belong to player"
        mockService.Setup(s => s.UpdateReviewAsync(venueId, userId, reviewId, It.IsAny<UpdateReviewRequestDto>()))
            .ThrowsAsync(new InvalidOperationException("BẠN CHỈ CÓ THỂ SỬA ĐÁNH GIÁ TRONG VÒNG 3 NGÀY."));

        var controller = CreateController(db, reviewService: mockService.Object, loggedInUserId: userId);

        var result = await controller.UpdateReview(venueId, reviewId, new UpdateReviewRequestDto());
        
        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("trong vòng 3 ngày", ReadPayload<ErrorMessageResponse>(conflict.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH DELEGATION (OK)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateReview_ShouldReturnOk_WithMappedResult_OnSuccessfulEdit()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();

        var returnedDto = new VenueReviewDto 
        { 
            Id = reviewId, 
            Stars = 3, 
            Comment = "Updated response!" 
        };

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.UpdateReviewAsync(venueId, userId, reviewId, It.IsAny<UpdateReviewRequestDto>()))
            .ReturnsAsync(returnedDto);

        var controller = CreateController(db, reviewService: mockService.Object, loggedInUserId: userId);

        var dto = new UpdateReviewRequestDto { Stars = 3, Comment = "Updated response!" };
        var result = await controller.UpdateReview(venueId, reviewId, dto);

        var ok = Assert.IsType<OkObjectResult>(result);
        var mappedObj = Assert.IsType<VenueReviewDto>(ok.Value);

        // Core assertions confirming the exact modified variables tunneled outward securely
        Assert.Equal(reviewId, mappedObj.Id);
        Assert.Equal(3, mappedObj.Stars);
        Assert.Equal("Updated response!", mappedObj.Comment);
        
        // Assert execution
        mockService.Verify(s => s.UpdateReviewAsync(venueId, userId, reviewId, dto), Times.Once);
    }
}

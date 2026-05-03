using System.Security.Claims;
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

public class VenueReviewsControllerGetReviewsTests
{
    private VenueReviewsController CreateController(
        ShuttleUpDbContext dbContext,
        IVenueReviewService? reviewService = null,
        IFileService? fileService = null,
        INotificationDispatchService? notifyService = null,
        Guid? loggedInUserId = null)
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

    // ══════════════════════════════════════════════════════════
    // 1. HAPPY PATH (SUCCESSFUL DELEGATION)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetReviews_ShouldReturnOk_WithDelegatedServiceData()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();

        var mockReviewDto = new VenueReviewListResponseDto
        {
            AverageStars = 4.5,
            TotalReviews = 10,
            Items = new List<VenueReviewItemDto>
            {
                new VenueReviewItemDto { Id = Guid.NewGuid(), Stars = 5, Comment = "Great" }
            }
        };

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.GetVenueReviewsAsync(venueId)).ReturnsAsync(mockReviewDto);

        var controller = CreateController(db, reviewService: mockService.Object);

        // Act (No login required for public reading)
        var result = await controller.GetReviews(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resDto = Assert.IsType<VenueReviewListResponseDto>(ok.Value);
        
        Assert.Equal(4.5, resDto.AverageStars);
        Assert.Single(resDto.Items);
        Assert.Equal("Great", resDto.Items[0].Comment);
        
        // Assert native pipeline pass-through
        mockService.Verify(s => s.GetVenueReviewsAsync(venueId), Times.Once);
    }

    [Fact]
    public async Task GetReviews_ShouldPropagateServiceExceptions_Transparently()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();

        var mockService = new Mock<IVenueReviewService>();
        mockService.Setup(s => s.GetVenueReviewsAsync(venueId)).ThrowsAsync(new InvalidOperationException("DB Crash Simulated"));

        var controller = CreateController(db, reviewService: mockService.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => controller.GetReviews(venueId));
    }
}

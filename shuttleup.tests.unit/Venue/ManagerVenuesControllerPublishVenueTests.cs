using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerPublishVenueTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext, IVenueService? venueService = null)
    {
        var mockVenueService = venueService != null ? Mock.Get(venueService) : new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        if (venueService == null)
        {
            mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));
            mockVenueService.Setup(s => s.UpdateAsync(It.IsAny<ShuttleUp.DAL.Models.Venue>())).Returns(Task.CompletedTask);
        }

        var controller = new ManagerVenuesController(
            mockVenueService.Object,
            mockCourtService.Object,
            dbContext,
            mockConfig.Object,
            mockVietQr.Object,
            mockNotify.Object,
            mockVenueReview.Object
        );

        return controller;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. AUTHENTICATION & EXISTENCE CHECK
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PublishVenue_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }; 

        var result = await controller.PublishVenue(Guid.NewGuid());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task PublishVenue_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); 

        var result = await controller.PublishVenue(Guid.NewGuid());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PublishVenue_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as different manager

        var result = await controller.PublishVenue(venueId);

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. HARD REQUIREMENTS VALIDATION CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PublishVenue_ShouldReturnBadRequest_WhenNoActiveCourtsExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = false });
        
        // No Courts whatsoever
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PublishVenue(venueId);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("có ít nhất 1 sân đang hoạt động", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PublishVenue_ShouldReturnBadRequest_WhenNoCourtPricingIsConfigured()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = false });
        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" }; // Valid court bounds present
        db.Courts.Add(court);
        
        // No CourtPrices whatsoever
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PublishVenue(venueId);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("phải cấu hình giá sân", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PublishVenue_ShouldReturnBadRequest_WhenNoOpenHoursConfigured()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = false });
        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" }; 
        db.Courts.Add(court);
        
        // Valid Pricing present
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, Price = 100 }); 
        
        // No VenueOpenHours AND No CourtOpenHours present
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PublishVenue(venueId);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("phải cấu hình giờ mở cửa", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. SECURE HAPPY PATHS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PublishVenue_ShouldActivateVenue_WhenAllRequirementsMet_WithVenueOpenHours()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var venue = new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = false };
        db.Venues.Add(venue);
        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" }; 
        db.Courts.Add(court);
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, Price = 100 });
        
        // Test Option A: VenueOpenHours
        db.VenueOpenHours.Add(new VenueOpenHour { Id = Guid.NewGuid(), VenueId = venueId, DayOfWeek = 1 });
        await db.SaveChangesAsync();

        var mockVenueService = new Mock<IVenueService>();
        mockVenueService.Setup(s => s.GetByIdAsync(venueId)).ReturnsAsync(db.Venues.First());
        mockVenueService.Setup(s => s.UpdateAsync(It.IsAny<ShuttleUp.DAL.Models.Venue>())).Returns(Task.CompletedTask);

        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PublishVenue(venueId);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(venue.IsActive);
        mockVenueService.Verify(s => s.UpdateAsync(venue), Times.Once); // Saves new state natively
    }

    [Fact]
    public async Task PublishVenue_ShouldActivateVenue_WhenAllRequirementsMet_WithCourtOpenHours()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var venue = new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = false };
        db.Venues.Add(venue);
        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" }; 
        db.Courts.Add(court);
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, Price = 100 });
        
        // Test Option B: CourtOpenHours (Fallback check passes too)
        db.CourtOpenHours.Add(new CourtOpenHour { Id = Guid.NewGuid(), CourtId = court.Id, DayOfWeek = 1 });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PublishVenue(venueId);

        Assert.IsType<OkObjectResult>(result);
        
        var updatedVenue = db.Venues.First(v => v.Id == venueId);
        Assert.True(updatedVenue.IsActive); // Asserting implicit Entity framework save works securely
    }
}

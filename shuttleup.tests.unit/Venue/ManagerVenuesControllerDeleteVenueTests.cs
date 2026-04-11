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

public class ManagerVenuesControllerDeleteVenueTests
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
            mockVenueService.Setup(s => s.DeleteAsync(It.IsAny<Guid>())).Returns(Task.CompletedTask);
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
    public async Task DeleteVenue_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }; 
        // Missing claims

        var result = await controller.DeleteVenue(Guid.NewGuid());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task DeleteVenue_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Authorized, but invalid GUID

        var result = await controller.DeleteVenue(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA ISOLATION / OWNERSHIP
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task DeleteVenue_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var unauthorizedManagerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, unauthorizedManagerId); // Logged in as different manager

        var result = await controller.DeleteVenue(venueId);

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH & DEPENDENCY PROPAGATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task DeleteVenue_ShouldCallDeleteAsyncAndReturnNoContent_WhenValidAndOwned()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var mockVenueService = new Mock<IVenueService>();
        mockVenueService.Setup(s => s.GetByIdAsync(venueId)).ReturnsAsync(db.Venues.First());
        
        // Ensure to intercept DeleteAsync and confirm it receives the correct Guid target
        Guid? capturedDeletedId = null;
        mockVenueService.Setup(s => s.DeleteAsync(It.IsAny<Guid>()))
            .Callback<Guid>(id => capturedDeletedId = id)
            .Returns(Task.CompletedTask);

        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.DeleteVenue(venueId);

        Assert.IsType<NoContentResult>(result);
        
        // Assert the invocation down to IVenueService
        Assert.NotNull(capturedDeletedId);
        Assert.Equal(venueId, capturedDeletedId);

        mockVenueService.Verify(s => s.DeleteAsync(venueId), Times.Once);
    }
}

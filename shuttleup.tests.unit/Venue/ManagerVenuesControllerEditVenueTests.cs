using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerEditVenueTests
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
            mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));
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
    public async Task EditVenue_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var request = new ManagerVenueUpsertDto { Name = "Test", Address = "Ha Noi" };
        var result = await controller.EditVenue(Guid.NewGuid(), request);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task EditVenue_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var request = new ManagerVenueUpsertDto { Name = "Test", Address = "Ha Noi" };
        var result = await controller.EditVenue(Guid.NewGuid(), request); // non-existent guid

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA ISOLATION / OWNERSHIP
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task EditVenue_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var hackerId = Guid.NewGuid(); // Some other manager attempting to exploit
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, hackerId); // Auth as non-owner

        var request = new ManagerVenueUpsertDto { Name = "Test", Address = "Ha Noi" };
        var result = await controller.EditVenue(venueId, request);

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 3. BOUNDARY CHECKS
    // ══════════════════════════════════════════════════════════
    [Theory]
    [InlineData(-91)]
    [InlineData(91)]
    public async Task EditVenue_ShouldReturnBadRequest_WhenLatitudeIsOutOfBounds(decimal invalidLat)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var request = new ManagerVenueUpsertDto { Name = "A", Address = "B", Lat = invalidLat, Lng = 100 };
        var result = await controller.EditVenue(Guid.NewGuid(), request);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("vĩ độ", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Theory]
    [InlineData(-181)]
    [InlineData(181)]
    public async Task EditVenue_ShouldReturnBadRequest_WhenLongitudeIsOutOfBounds(decimal invalidLng)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var request = new ManagerVenueUpsertDto { Name = "A", Address = "B", Lat = 10, Lng = invalidLng };
        var result = await controller.EditVenue(Guid.NewGuid(), request);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("kinh độ", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH & OVERRIDE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task EditVenue_ShouldUpdateVenue_AndSerializeComplexTypes_WhenValidInputProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var existingVenue = new ShuttleUp.DAL.Models.Venue 
        { 
            Id = venueId, 
            OwnerUserId = managerId, 
            Name = "Old Name", 
            Address = "Old Address", 
            Includes = "[\"Gửi xe\"]"
        };
        db.Venues.Add(existingVenue);
        await db.SaveChangesAsync();

        var mockVenueService = new Mock<IVenueService>();
        mockVenueService.Setup(s => s.GetByIdAsync(venueId)).ReturnsAsync(existingVenue);
        
        ShuttleUp.DAL.Models.Venue? capturedVenue = null;
        mockVenueService.Setup(s => s.UpdateAsync(It.IsAny<ShuttleUp.DAL.Models.Venue>()))
            .Callback<ShuttleUp.DAL.Models.Venue>(v =>
            {
                capturedVenue = v;
            })
            .Returns(Task.CompletedTask);

        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var request = new ManagerVenueUpsertDto
        {
            Name = "New Name",
            Address = "New Address",
            Lat = null, Lng = null, // Can clear coordinates
            ContactName = "New Contact",
            Description = "Upgraded Venue",
            Includes = new List<string> { "Trà đá", "Góp bóng" }, // Overwriting old values
            Rules = new List<string> { "Giày chuyên dụng" }
        };

        var result = await controller.EditVenue(venueId, request);

        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.NotNull(capturedVenue);
        Assert.Equal("New Name", capturedVenue.Name);
        Assert.Equal("New Address", capturedVenue.Address);
        Assert.Null(capturedVenue.Lat);
        Assert.Null(capturedVenue.Lng);
        Assert.Equal("New Contact", capturedVenue.ContactName);
        Assert.Equal("Upgraded Venue", capturedVenue.Description);
        
        // Ensure complex mappings override string JSON directly into the object reference passed to UpdateAsync
        Assert.Contains("Trà đá", capturedVenue.Includes);
        Assert.Contains("Giày chuyên dụng", capturedVenue.Rules);
        Assert.Null(capturedVenue.Amenities); // Handled null properly over explicit value
    }
}

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

public class ManagerVenuesControllerAddVenueTests
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
            mockVenueService.Setup(s => s.CreateAsync(It.IsAny<ShuttleUp.DAL.Models.Venue>()))
                .Callback<ShuttleUp.DAL.Models.Venue>(v => 
                {
                    v.Id = Guid.NewGuid();
                    dbContext.Venues.Add(v); // Emulate save
                })
                .Returns(Task.CompletedTask);
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
    // 1. AUTHENTICATION & VALIDATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task AddVenue_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }; 
        // No Claims attached

        var request = new ManagerVenueUpsertDto { Name = "Test", Address = "Ha Noi" };
        var result = await controller.AddVenue(request);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task AddVenue_ShouldReturnBadRequest_WhenModelStateIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());
        controller.ModelState.AddModelError("Name", "Name is required");

        var request = new ManagerVenueUpsertDto { Address = "No Name" };
        var result = await controller.AddVenue(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. BOUNDARY CHECKS (Latitude & Longitude)
    // ══════════════════════════════════════════════════════════
    [Theory]
    [InlineData(-91)]
    [InlineData(91)]
    public async Task AddVenue_ShouldReturnBadRequest_WhenLatitudeIsOutOfBounds(decimal invalidLat)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var request = new ManagerVenueUpsertDto 
        { 
            Name = "A", Address = "B", Lat = invalidLat, Lng = 100 
        };
        var result = await controller.AddVenue(request);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("vĩ độ", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Theory]
    [InlineData(-181)]
    [InlineData(181)]
    public async Task AddVenue_ShouldReturnBadRequest_WhenLongitudeIsOutOfBounds(decimal invalidLng)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var request = new ManagerVenueUpsertDto 
        { 
            Name = "A", Address = "B", Lat = 10, Lng = invalidLng 
        };
        var result = await controller.AddVenue(request);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("kinh độ", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH & DATA PERSISTENCE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task AddVenue_ShouldCreateVenueSuccessfully_AndSerializeComplexTypes()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        
        var mockVenueService = new Mock<IVenueService>();
        ShuttleUp.DAL.Models.Venue? capturedVenue = null;
        mockVenueService.Setup(s => s.CreateAsync(It.IsAny<ShuttleUp.DAL.Models.Venue>()))
            .Callback<ShuttleUp.DAL.Models.Venue>(v =>
            {
                v.Id = Guid.NewGuid();
                capturedVenue = v;
            })
            .Returns(Task.CompletedTask);

        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var request = new ManagerVenueUpsertDto
        {
            Name = "Sân Cầu Lông Elite",
            Address = "123 Đường A, Hà Nội",
            Lat = 21.0285m,
            Lng = 105.8542m,
            ContactName = "Manager Joe",
            ContactPhone = "0987654321",
            WeeklyDiscountPercent = 5,
            MonthlyDiscountPercent = 10,
            Description = "VIP Venue",
            Includes = new List<string> { "Trà đá", "Góp bóng" },
            Rules = new List<string> { "Không hút thuốc" },
            Amenities = new List<string> { "WIFI", "PARKING" }
        };

        var result = await controller.AddVenue(request);

        // Explicitly assert correct CreatedAt result shape
        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal("GetManagedVenues", created.ActionName);

        // Verification of payload mappings passing over to IVenueService
        Assert.NotNull(capturedVenue);
        Assert.Equal(managerId, capturedVenue.OwnerUserId);
        Assert.Equal("Sân Cầu Lông Elite", capturedVenue.Name);
        Assert.Equal("123 Đường A, Hà Nội", capturedVenue.Address);
        Assert.Equal(21.0285m, capturedVenue.Lat);
        Assert.Equal(105.8542m, capturedVenue.Lng);
        Assert.Equal("Manager Joe", capturedVenue.ContactName);
        Assert.Equal("0987654321", capturedVenue.ContactPhone);
        Assert.Equal(5, capturedVenue.WeeklyDiscountPercent);
        Assert.Equal(10, capturedVenue.MonthlyDiscountPercent);
        Assert.Equal("VIP Venue", capturedVenue.Description);
        
        // Assert JSON Serialization works flawlessly internally
        Assert.Contains("Trà đá", capturedVenue.Includes);
        Assert.Contains("Không hút thuốc", capturedVenue.Rules);
        Assert.Contains("WIFI", capturedVenue.Amenities);
    }
}

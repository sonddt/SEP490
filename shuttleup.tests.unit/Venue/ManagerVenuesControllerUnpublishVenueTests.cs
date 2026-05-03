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

public class ManagerVenuesControllerUnpublishVenueTests
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
    public async Task UnpublishVenue_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }; 

        var result = await controller.UnpublishVenue(Guid.NewGuid());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task UnpublishVenue_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); 

        var result = await controller.UnpublishVenue(Guid.NewGuid());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UnpublishVenue_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as Hacker

        var result = await controller.UnpublishVenue(venueId);
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE DEPENDENT VALIDATION CHECKS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UnpublishVenue_ShouldReturnBadRequest_WhenThereAreActiveFutureBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var venue = new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = true };
        db.Venues.Add(venue);
        
        // Setting up an active CONFIRMED booking pointing to a future date
        var futureBooking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), 
            VenueId = venueId, 
            Status = "CONFIRMED",
            BookingItems = new List<BookingItem>
            {
                new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddDays(2) }
            }
        };
        db.Bookings.Add(futureBooking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.UnpublishVenue(venueId);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("lịch đặt ở tương lai", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UnpublishVenue_ShouldSucceed_WhenFutureBookingsAreAlreadyCancelled()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var venue = new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = true };
        db.Venues.Add(venue);
        
        // The booking is in the future, BUT it has already been cancelled
        var futureCancelledBooking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), 
            VenueId = venueId, 
            Status = "CANCELLED",
            BookingItems = new List<BookingItem>
            {
                new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddDays(2) }
            }
        };
        db.Bookings.Add(futureCancelledBooking);
        await db.SaveChangesAsync();

        var mockVenueService = new Mock<IVenueService>();
        mockVenueService.Setup(s => s.GetByIdAsync(venueId)).ReturnsAsync(venue);
        
        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.UnpublishVenue(venueId);

        Assert.IsType<OkObjectResult>(result);
        Assert.False(venue.IsActive); // Asserts DB side effect correctly flipped
    }

    // ══════════════════════════════════════════════════════════
    // 3. SECURE HAPPY PATHS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UnpublishVenue_ShouldSucceed_WhenAllActiveBookingsAreInThePast()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var venue = new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, IsActive = true };
        db.Venues.Add(venue);
        
        // Active booking, but historically passed timeline 
        var pastBooking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), 
            VenueId = venueId, 
            Status = "CONFIRMED",
            BookingItems = new List<BookingItem>
            {
                new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddDays(-2) }
            }
        };
        db.Bookings.Add(pastBooking);
        await db.SaveChangesAsync();

        var mockVenueService = new Mock<IVenueService>();
        mockVenueService.Setup(s => s.GetByIdAsync(venueId)).ReturnsAsync(venue);
        
        var controller = CreateController(db, mockVenueService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.UnpublishVenue(venueId);

        Assert.IsType<OkObjectResult>(result);
        Assert.False(venue.IsActive); // Venue successfully toggled
        mockVenueService.Verify(s => s.UpdateAsync(venue), Times.Once); // Saves natively
    }
}

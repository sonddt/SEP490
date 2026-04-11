using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

public class ManagerVenuesControllerSetCourtStatusTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockVenueService = new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));

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

    private class ConflictMessageResponse { public string Message { get; set; } = ""; public int Count { get; set; } }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION & AUTHENTICATION 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SetCourtStatus_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.SetCourtStatus(Guid.NewGuid(), Guid.NewGuid(), new CourtStatusUpdateDto());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task SetCourtStatus_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.SetCourtStatus(Guid.NewGuid(), Guid.NewGuid(), new CourtStatusUpdateDto());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task SetCourtStatus_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as different manager

        var result = await controller.SetCourtStatus(venueId, Guid.NewGuid(), new CourtStatusUpdateDto());
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task SetCourtStatus_ShouldReturnNotFound_WhenCourtBelongsToDifferentVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = Guid.NewGuid() }); // Mismatched venue
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.SetCourtStatus(venueId, courtId, new CourtStatusUpdateDto());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại trong venue", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE DEADLOCK VALIDATION (FUTURE BOOKINGS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SetCourtStatus_ShouldReturnConflict_WhenDeactivatingCourtWithFutureBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, IsActive = true });
        
        // Add a future booking that triggers deadlock
        db.BookingItems.Add(new BookingItem 
        { 
            Id = Guid.NewGuid(), 
            CourtId = courtId, 
            EndTime = DateTime.UtcNow.AddDays(2),
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "CONFIRMED" } 
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CourtStatusUpdateDto { IsActive = false, Force = false }; // Standard deactivation block
        
        var result = await controller.SetCourtStatus(venueId, courtId, dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var resObj = ReadPayload<ConflictMessageResponse>(conflict.Value);
        Assert.Equal("HAS_FUTURE_BOOKINGS", resObj.Message);
        Assert.Equal(1, resObj.Count);
    }

    [Fact]
    public async Task SetCourtStatus_ShouldDeactivateCourt_WhenFutureBookingsExistButForceOverrideIsUsed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, IsActive = true });
        
        // Overlapping future booking
        db.BookingItems.Add(new BookingItem 
        { 
            Id = Guid.NewGuid(), 
            CourtId = courtId, 
            EndTime = DateTime.UtcNow.AddDays(2),
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "CONFIRMED" } 
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CourtStatusUpdateDto { IsActive = false, Force = true }; // OVERRIDE ENFORCED
        
        var result = await controller.SetCourtStatus(venueId, courtId, dto);

        Assert.IsType<OkObjectResult>(result);
        var updatedCourt = await db.Courts.FirstAsync(c => c.Id == courtId);
        Assert.False(updatedCourt.IsActive);
    }

    [Fact]
    public async Task SetCourtStatus_ShouldDeactivateCourt_WhenFutureBookingsExistButAreCancelled()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, IsActive = true });
        
        // Overlapping CANCELLED future booking
        db.BookingItems.Add(new BookingItem 
        { 
            Id = Guid.NewGuid(), 
            CourtId = courtId, 
            EndTime = DateTime.UtcNow.AddDays(2),
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "CANCELLED" } // Cancelled bypass
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CourtStatusUpdateDto { IsActive = false, Force = false }; 
        
        var result = await controller.SetCourtStatus(venueId, courtId, dto);

        Assert.IsType<OkObjectResult>(result);
        var updatedCourt = await db.Courts.FirstAsync(c => c.Id == courtId);
        Assert.False(updatedCourt.IsActive);
    }

    // ══════════════════════════════════════════════════════════
    // 3. SECURE HAPPY PATHS (Reactivation logic)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SetCourtStatus_ShouldReactivateCourtSuccessfully_WithoutBookingCalculations()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, IsActive = false });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CourtStatusUpdateDto { IsActive = true }; 
        
        var result = await controller.SetCourtStatus(venueId, courtId, dto);

        Assert.IsType<OkObjectResult>(result);
        var updatedCourt = await db.Courts.FirstAsync(c => c.Id == courtId);
        Assert.True(updatedCourt.IsActive);
    }
}

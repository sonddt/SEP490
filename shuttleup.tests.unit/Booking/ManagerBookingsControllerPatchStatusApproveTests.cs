using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class ManagerBookingsControllerPatchStatusApproveTests
{
    private ManagerBookingsController CreateController(ShuttleUpDbContext dbContext, INotificationDispatchService? notify = null)
    {
        var mockNotify = notify != null ? Mock.Get(notify) : new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();
        return new ManagerBookingsController(dbContext, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. INPUT VALIDATION & AUTH
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.PatchStatus(Guid.NewGuid(), new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task PatchStatus_ShouldReturnBadRequest_WhenStatusMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.PatchStatus(Guid.NewGuid(), new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "  " });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Thiếu trạng thái", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA EXISTENCE & OWNERSHIP
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_ShouldReturnNotFound_WhenBookingDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.PatchStatus(Guid.NewGuid(), new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task PatchStatus_ShouldReturnForbid_WhenBookingBelongsToOtherManager()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myManagerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = otherManagerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING" };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, myManagerId); // Current user is NOT the owner

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 3. STATE TRANSITION RULES (CONFIRM)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Confirm_ShouldReturnBadRequest_WhenAlreadyCancelled()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId, Status = "CANCELLED" };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Đơn đã bị huỷ", err.Message);
    }

    [Fact]
    public async Task PatchStatus_Confirm_ShouldReturnBadRequest_WhenNotPending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        // Status is CONFIRMED (Not PENDING)
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId, Status = "CONFIRMED" };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Chỉ có thể duyệt đơn đang chờ", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 4. DEPENDENCY VALIDATION (PROOF REQUIRED)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Confirm_ShouldReturnBadRequest_WhenNoValidPaymentProof()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        
        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING",
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), GatewayReference = "invalid_url_not_https" }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Chưa có chứng từ chuyển khoản hợp lệ", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 5. HAPPY PATH (SUCCESS & SIDE EFFECTS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Confirm_ShouldSucceed_AndCascadeUpdates_AndSendNotification()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId, Name = "TestVenue" });
        db.BookingSeries.Add(new BookingSeries { Id = seriesId, Status = "PENDING" });

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, UserId = playerId, Status = "PENDING", SeriesId = seriesId, ManagerStatusNote = "old note",
            BookingItems = new List<BookingItem> { new BookingItem { Id = Guid.NewGuid(), Status = "HOLDING" } },
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", GatewayReference = "https://proof.png" }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, mockNotify.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CONFIRMED" });

        var ok = Assert.IsType<OkObjectResult>(result);

        // Assert DB Changes
        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("CONFIRMED", updatedBooking.Status);
        Assert.Null(updatedBooking.ManagerStatusNote);
        
        var updatedItem = db.BookingItems.First(bi => bi.BookingId == booking.Id);
        Assert.Equal("CONFIRMED", updatedItem.Status);

        var updatedPayment = db.Payments.First(p => p.BookingId == booking.Id);
        Assert.Equal("COMPLETED", updatedPayment.Status);
        Assert.Equal(managerId, updatedPayment.ConfirmedBy);
        Assert.NotNull(updatedPayment.ConfirmedAt);

        var updatedSeries = db.BookingSeries.First(s => s.Id == seriesId);
        Assert.Equal("ACTIVE", updatedSeries.Status);

        // Assert Notifications
        mockNotify.Verify(n => n.NotifyUserAsync(
            playerId,
            "BOOKING",
            "Đơn đặt sân đã được duyệt",
            It.Is<string>(s => s.Contains("đã được chủ sân xác nhận")),
            It.IsAny<object>(),
            true,
            It.IsAny<object>()), Times.Once);
    }
}

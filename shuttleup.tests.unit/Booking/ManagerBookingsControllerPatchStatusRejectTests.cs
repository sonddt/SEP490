using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class ManagerBookingsControllerPatchStatusRejectTests
{
    private ManagerBookingsController CreateController(
        ShuttleUpDbContext dbContext, 
        INotificationDispatchService? notify = null,
        IMatchingPostLifecycleService? matchingLifecycle = null)
    {
        var mockNotify = notify != null ? Mock.Get(notify) : new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = matchingLifecycle != null ? Mock.Get(matchingLifecycle) : new Mock<IMatchingPostLifecycleService>();
        
        return new ManagerBookingsController(dbContext, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. STATE TRANSITION RULES (REJECT/CANCEL)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Cancel_ShouldReturnBadRequest_WhenStatusIsHolding()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId, Status = "HOLDING" };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CANCELLED" });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Không thể huỷ đơn ở trạng thái này", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 2. HAPPY PATH: DIRECT CANCEL (NO PAYMENT)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Cancel_ShouldCancelDirectly_WhenNoCompletedPayments()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId, Name = "TestVenue" });
        db.BookingSeries.Add(new BookingSeries { Id = seriesId, Status = "ACTIVE" });

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, UserId = playerId, Status = "PENDING", SeriesId = seriesId,
            BookingItems = new List<BookingItem> { new BookingItem { Id = Guid.NewGuid(), Status = "HOLDING" } },
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", Amount = 50000 } // Not completed
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var mockLifecycle = new Mock<IMatchingPostLifecycleService>();
        var controller = CreateController(db, mockNotify.Object, mockLifecycle.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CANCELLED", Reason = "Sân kẹt lịch" };
        var result = await controller.PatchStatus(booking.Id, dto);

        Assert.IsType<OkObjectResult>(result);

        // Assert DB Changes
        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("CANCELLED", updatedBooking.Status);
        Assert.Equal("Sân kẹt lịch", updatedBooking.ManagerStatusNote);
        
        var updatedItem = db.BookingItems.First(bi => bi.BookingId == booking.Id);
        Assert.Equal("CANCELLED", updatedItem.Status);

        var updatedPayment = db.Payments.First(p => p.BookingId == booking.Id);
        Assert.Equal("CANCELLED", updatedPayment.Status); // PENDING payment canceled

        var updatedSeries = db.BookingSeries.First(s => s.Id == seriesId);
        Assert.Equal("CANCELLED", updatedSeries.Status);

        Assert.Empty(db.RefundRequests); // No refund needed

        // Assert Notifications & Matching Post lifecycle
        mockLifecycle.Verify(m => m.CancelPostsByBookingAsync(It.IsAny<ShuttleUp.DAL.Models.Booking>(), "chủ sân", It.IsAny<CancellationToken>()), Times.Once);

        mockNotify.Verify(n => n.NotifyUserAsync(
            playerId,
            "BOOKING",
            "Cập nhật đơn đặt sân",
            It.Is<string>(s => s.Contains("Sân kẹt lịch")),
            It.IsAny<object>(),
            true,
            It.IsAny<object>()), Times.Once);
    }

    // ══════════════════════════════════════════════════════════
    // 3. REFUND FLOW: PENDING_REFUND
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PatchStatus_Cancel_ShouldTransitionToPendingRefund_WhenPaymentConfirmed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, UserId = Guid.NewGuid(), Status = "CONFIRMED",
            BookingItems = new List<BookingItem> { new BookingItem { Id = Guid.NewGuid(), Status = "CONFIRMED" } },
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "COMPLETED", Amount = 100000 },
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", Amount = 20000 }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.PatchStatus(booking.Id, new ManagerBookingsController.ManagerBookingStatusPatchDto { Status = "CANCELLED", Reason = "Lỗi kỹ thuật" });

        Assert.IsType<OkObjectResult>(result);

        // Assert DB Changes
        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("PENDING_REFUND", updatedBooking.Status); // NOT cancelled!
        
        var updatedItem = db.BookingItems.First(bi => bi.BookingId == booking.Id);
        Assert.Equal("CONFIRMED", updatedItem.Status); // Items remain as they were because booking isn't CANCELLED yet

        var pendingPayment = db.Payments.First(p => p.Amount == 20000);
        Assert.Equal("CANCELLED", pendingPayment.Status); // Excess pending payment is canceled

        var completedPayment = db.Payments.First(p => p.Amount == 100000);
        Assert.Equal("COMPLETED", completedPayment.Status); // Remains completed

        // Verify Refund Request Generation
        var refundReq = db.RefundRequests.FirstOrDefault(r => r.BookingId == booking.Id);
        Assert.NotNull(refundReq);
        Assert.Equal("PENDING_REFUND", refundReq.Status);
        Assert.Equal("MANAGER_CANCEL", refundReq.ReasonCode);
        Assert.Equal(100000, refundReq.PaidAmount);
        Assert.Equal(100000, refundReq.RequestedAmount);
    }
}

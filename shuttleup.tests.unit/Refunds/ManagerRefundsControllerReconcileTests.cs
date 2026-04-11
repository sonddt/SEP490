using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Refunds;

public class ManagerRefundsControllerReconcileTests
{
    private ManagerRefundsController CreateController(ShuttleUpDbContext db, INotificationDispatchService? notify = null, IFileService? fileService = null)
    {
        var mockNotify = notify != null ? Mock.Get(notify) : new Mock<INotificationDispatchService>();
        var mockFileService = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();

        return new ManagerRefundsController(db, mockNotify.Object, mockFileService.Object);
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. INPUT VALIDATION & OWNERSHIP
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task Reconcile_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.Reconcile(Guid.NewGuid(), new ManagerRefundsController.ReconcileDto { Confirmed = true });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Reconcile_ShouldReturnForbid_WhenVenueNotOwnedByManager()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myManagerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = otherManagerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId };
        db.Bookings.Add(booking);
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, myManagerId); // Current user is NOT the owner

        var result = await controller.Reconcile(refund.Id, new ManagerRefundsController.ReconcileDto { Confirmed = true });

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task Reconcile_ShouldReturnBadRequest_WhenNotInPendingReconciliationState()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId };
        db.Bookings.Add(booking);
        
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "PENDING_REFUND" }; // WRONG STATE
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.Reconcile(refund.Id, new ManagerRefundsController.ReconcileDto { Confirmed = true });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Yêu cầu không ở trạng thái cần đối soát", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 2. HAPPY PATH - CONFIRMED = TRUE (Money Received)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task Reconcile_ShouldConfirmPaymentAndShiftToPendingRefund_WhenConfirmed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });

        var snapshot = new CancellationPolicySnapshot
        {
            Rules = new List<CancellationRuleSnapshot>
            {
                new CancellationRuleSnapshot { MinimumNoticeHours = 0, RefundPercentage = 50 } // 50% refund
            }
        };

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING_RECONCILIATION",
            CancellationPolicySnapshotJson = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", Amount = 100000 }
            }
        };
        db.Bookings.Add(booking);

        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "PENDING_RECONCILIATION", UserId = playerId };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, mockNotify.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.Reconcile(refund.Id, new ManagerRefundsController.ReconcileDto { Confirmed = true });

        var ok = Assert.IsType<OkObjectResult>(result);

        var updatedRefund = db.RefundRequests.First(r => r.Id == refund.Id);
        Assert.Equal("PENDING_REFUND", updatedRefund.Status);
        Assert.Equal(100000, updatedRefund.PaidAmount);
        Assert.Equal(50000, updatedRefund.RequestedAmount); // 50% of 100,000

        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("PENDING_REFUND", updatedBooking.Status);

        var updatedPayment = db.Payments.First(p => p.BookingId == booking.Id);
        Assert.Equal("COMPLETED", updatedPayment.Status);
        Assert.Equal(managerId, updatedPayment.ConfirmedBy);

        mockNotify.Verify(n => n.NotifyUserAsync(
            playerId,
            "REFUND_RECONCILED",
            "Chủ sân đã xác nhận nhận tiền",
            It.IsAny<string>(),
            It.IsAny<object>(),
            false, // no email
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - CONFIRMED = FALSE (Fraud/Blurry Auth)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task Reconcile_ShouldReject_WhenConfirmedIsFalse_AndReasonIsProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING_RECONCILIATION",
            BookingItems = new List<BookingItem> { new BookingItem { Id = Guid.NewGuid(), Status = "HOLDING" } },
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", Amount = 100000 }
            }
        };
        db.Bookings.Add(booking);

        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "PENDING_RECONCILIATION", UserId = playerId };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, mockNotify.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.Reconcile(refund.Id, new ManagerRefundsController.ReconcileDto { Confirmed = false, Reason = "Biên lai giả mạo" });

        var ok = Assert.IsType<OkObjectResult>(result);

        var updatedRefund = db.RefundRequests.First(r => r.Id == refund.Id);
        Assert.Equal("REJECTED", updatedRefund.Status);
        Assert.Equal("Biên lai giả mạo", updatedRefund.RejectionReason);
        Assert.Equal(managerId, updatedRefund.ProcessedBy);

        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("CANCELLED", updatedBooking.Status);

        var updatedItem = db.BookingItems.First();
        Assert.Equal("CANCELLED", updatedItem.Status);

        var updatedPayment = db.Payments.First();
        Assert.Equal("CANCELLED", updatedPayment.Status);

        mockNotify.Verify(n => n.NotifyUserAsync(
            playerId,
            "REFUND_REJECTED",
            "Yêu cầu hoàn tiền bị từ chối",
            It.Is<string>(s => s.Contains("Biên lai giả mạo")),
            It.IsAny<object>(),
            false,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reconcile_ShouldReturnBadRequest_WhenConfirmedIsFalse_ButReasonIsMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });

        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING_RECONCILIATION" };
        db.Bookings.Add(booking);
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "PENDING_RECONCILIATION" };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.Reconcile(refund.Id, new ManagerRefundsController.ReconcileDto { Confirmed = false, Reason = "   " }); // Empty Reason

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("vui lòng nhập lý do", err.Message.ToLowerInvariant());
    }
}

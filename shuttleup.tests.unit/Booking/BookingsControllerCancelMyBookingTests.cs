using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.BookingsController;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerCancelMyBookingTests
{
    private BookingsController CreateController(
        ShuttleUpDbContext dbContext,
        Guid? loggedInUserId = null,
        INotificationDispatchService? notifyService = null,
        IMatchingPostLifecycleService? lifecycleService = null)
    {
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockLifecycle = lifecycleService != null ? Mock.Get(lifecycleService) : new Mock<IMatchingPostLifecycleService>();

        var controller = new BookingsController(
            dbContext,
            mockFile.Object,
            mockNotify.Object,
            mockLifecycle.Object
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

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION RULES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelMyBooking_ShouldReturnUnauthorizedOrNotFound_WhenSecurityViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var bookingOwnerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, UserId = bookingOwnerId });
        await db.SaveChangesAsync();

        var controllerAnon = CreateController(db, loggedInUserId: null);
        var rAnon = await controllerAnon.CancelMyBooking(bookingId, null);
        Assert.IsType<UnauthorizedObjectResult>(rAnon);

        // Map checking alien isolation. Expected to NOT leak database context.
        var controllerAlien = CreateController(db, loggedInUserId: Guid.NewGuid());
        var rAlien = await controllerAlien.CancelMyBooking(bookingId, null);
        Assert.IsType<NotFoundObjectResult>(rAlien);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE LOCKOUTS & POLICY PARADOXES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelMyBooking_ShouldReturnBadRequest_WhenStatusIsInvalidOrTimelineDisallowsCancellation()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();

        // Target A: Already tracking cancellation
        var doubleCancel = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "PENDING_RECONCILIATION" };

        // Target B: In Holding state. (Holding utilizes CancelHold, NOT CancelMyBooking functionally)
        var holdingBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "HOLDING" };

        // Target C: Policy strict restriction
        var strictPolicy = JsonSerializer.Serialize(new { AllowCancel = false });
        var strictBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CONFIRMED", CancellationPolicySnapshotJson = strictPolicy };

        // Target D: Timeline Expired (e.g. Trying to cancel 1 minute before game time when Policy requires 120 minutes)
        var limitPolicy = JsonSerializer.Serialize(new { AllowCancel = true, CancelBeforeMinutes = 120 });
        var expiredBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CONFIRMED", CancellationPolicySnapshotJson = limitPolicy };
        expiredBooking.BookingItems.Add(new BookingItem { StartTime = DateTime.UtcNow.AddMinutes(90) }); // Too late to cancel structurally

        db.Bookings.AddRange(doubleCancel, holdingBooking, strictBooking, expiredBooking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var r1 = await controller.CancelMyBooking(doubleCancel.Id, null);
        Assert.Contains("đã bị huỷ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        var r2 = await controller.CancelMyBooking(holdingBooking.Id, null);
        Assert.Contains("không thể huỷ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());

        var r3 = await controller.CancelMyBooking(strictBooking.Id, null);
        Assert.Contains("không thể tự huỷ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r3).Value).Message.ToLowerInvariant());

        var r4 = await controller.CancelMyBooking(expiredBooking.Id, null);
        Assert.Contains("quá thời hạn", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r4).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - BRANCH NO_PAYMENT
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelMyBooking_ShouldCancelCleanlyWithoutGeneratingRefund_WhenBranchIsNoPayment()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var bId = Guid.NewGuid();

        var flexiblePolicy = JsonSerializer.Serialize(new { AllowCancel = true, CancelBeforeMinutes = 60 });
        var venue = new Venue { Id = Guid.NewGuid(), OwnerUserId = ownerId };
        
        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = bId, UserId = memberId, Status = "PENDING", VenueId = venue.Id, Venue = venue,
            CancellationPolicySnapshotJson = flexiblePolicy 
        };
        booking.BookingItems.Add(new BookingItem { StartTime = DateTime.UtcNow.AddDays(1), Status = "PENDING" });
        // NOTE: No payments inserted into the array natively!

        db.Venues.Add(venue);
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var mockLifecycle = new Mock<IMatchingPostLifecycleService>();
        var controller = CreateController(db, loggedInUserId: memberId, notifyService: mockNotify.Object, lifecycleService: mockLifecycle.Object);

        var result = await controller.CancelMyBooking(bId, null);
        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.Equal("CANCELLED", booking.Status); 
        Assert.Equal("CANCELLED", booking.BookingItems.First().Status); // Verify cascade collapse!
        Assert.Empty(db.RefundRequests.ToList()); // Branch NO_PAYMENT mathematically cannot trigger Refund tracking

        mockLifecycle.Verify(m => m.CancelPostsByBookingAsync(booking, "người chơi", It.IsAny<CancellationToken>()), Times.Once);

        mockNotify.Verify(n => n.NotifyUserAsync(
            ownerId, NotificationTypes.RefundRequest, "Đơn đặt sân bị hủy", It.Is<string>(s => s.Contains("đã bị người chơi hủy.")),
            It.IsAny<object>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH - BRANCH PROOF_UPLOADED
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelMyBooking_ShouldYieldPendingReconciliationAndRefundRequest_WhenBranchIsProofUploaded()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var bId = Guid.NewGuid();

        var flexiblePolicy = JsonSerializer.Serialize(new { AllowCancel = true, CancelBeforeMinutes = 60 });
        
        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = bId, UserId = memberId, Status = "PENDING",
            CancellationPolicySnapshotJson = flexiblePolicy,
            TotalAmount = 100000 
        };
        booking.BookingItems.Add(new BookingItem { StartTime = DateTime.UtcNow.AddDays(1), Status = "PENDING" });
        
        // Simulating the user already uploaded a screenshot, but it hasn't mapped internally yet
        booking.Payments.Add(new Payment { Status = "PENDING", Amount = 100000, GatewayReference = "https://proof" });

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);
        
        var formBody = new CancelBookingBody { RefundBankName = "MB Bank", RefundAccountHolder = "hieu" };
        var result = await controller.CancelMyBooking(bId, formBody);
        
        Assert.IsType<OkObjectResult>(result);

        // Core Verify: Because they uploaded proof but it hasn't cleared, it goes into Reconciliation timeout.
        Assert.Equal("PENDING_RECONCILIATION", booking.Status); 
        
        var req = db.RefundRequests.Single();
        Assert.Equal(bId, req.BookingId);
        Assert.Equal("PENDING_RECONCILIATION", req.Status);
        Assert.Equal("MB Bank", req.RefundBankName);
        Assert.Equal("HIEU", req.RefundAccountHolder); // Must dynamically normalize correctly upstream
        Assert.Null(req.PaidAmount); // Paid Amount hasn't logically been determined yet because the host must review the proof!
    }

    // ══════════════════════════════════════════════════════════
    // 5. HAPPY PATH - BRANCH PAID (Calculates accurate penalty)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelMyBooking_ShouldCalculateRefundAndYieldPendingRefund_WhenBranchIsPaid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var bId = Guid.NewGuid();

        // Context Policy strictly locks refunds at PERCENT 70% returning metrics
        var flexiblePolicy = JsonSerializer.Serialize(new { AllowCancel = true, CancelBeforeMinutes = 60, RefundType = "PERCENT", RefundPercent = 70 });
        
        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = bId, UserId = memberId, Status = "CONFIRMED",
            CancellationPolicySnapshotJson = flexiblePolicy,
            TotalAmount = 200000 
        };
        booking.BookingItems.Add(new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) });
        
        // Simulating the transaction successfully cleared entirely
        booking.Payments.Add(new Payment { Status = "COMPLETED", Amount = 200000, GatewayReference = "https://proof.png" });

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var result = await controller.CancelMyBooking(bId, new CancelBookingBody());
        Assert.IsType<OkObjectResult>(result);

        // Core Verifies
        Assert.Equal("PENDING_REFUND", booking.Status); 
        
        var req = db.RefundRequests.Single();
        Assert.Equal("PENDING_REFUND", req.Status);
        Assert.Equal(200000, req.PaidAmount);

        // Math Deduction: 200000 * 70% = 140000!
        Assert.Equal(140000m, req.RequestedAmount);
    }
}

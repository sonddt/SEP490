using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerCancelPreviewTests
{
    private BookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockFileService = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();
        return new BookingsController(dbContext, mockFileService.Object, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse
    {
        public string Message { get; set; } = "";
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private static string PolicyJson(bool allowCancel = true, int cancelBeforeMinutes = 120, string refundType = "PERCENT", decimal? refundPercent = 80)
    {
        return JsonSerializer.Serialize(new
        {
            allowCancel = allowCancel,
            cancelBeforeMinutes = cancelBeforeMinutes,
            refundType = refundType,
            refundPercent = refundPercent
        });
    }

    // ══════════════════════════════════════════════════════════
    // 1. UNAUTHORIZED
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.CancelPreview(Guid.NewGuid());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. MISSING DATA
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldReturnNotFound_WhenBookingDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.CancelPreview(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(notFound.Value);
        Assert.Equal("Không tìm thấy đơn đặt.", err.Message);
    }

    [Fact]
    public async Task CancelPreview_ShouldReturnNotFound_WhenBookingBelongsToOtherUser()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, UserId = ownerId, Status = "PENDING" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Different user

        var result = await controller.CancelPreview(bookingId);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(notFound.Value);
        Assert.Equal("Không tìm thấy đơn đặt.", err.Message);
    }

    // ══════════════════════════════════════════════════════════
    // 3. POLICY: AllowCancel = false
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldDisableCancel_WhenPolicySaysNo()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "CONFIRMED",
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: false),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) } }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.False(body.GetProperty("canCancel").GetBoolean());
        Assert.Contains("không cho phép hủy", body.GetProperty("disableReason").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 4. POLICY: Deadline missed
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldDisableCancel_WhenDeadlinePassed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        // Starts in 30 mins, policy requires 60 mins notice
        var startTime = DateTime.UtcNow.AddMinutes(30);

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "CONFIRMED",
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: true, cancelBeforeMinutes: 60),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = startTime } }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.False(body.GetProperty("canCancel").GetBoolean());
        Assert.Contains("Đã quá hạn hủy", body.GetProperty("disableReason").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 5. STATUS: Invalid status
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldDisableCancel_WhenStatusCancelled()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "CANCELLED",
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: true, cancelBeforeMinutes: 60),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) } }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.False(body.GetProperty("canCancel").GetBoolean());
        Assert.Contains("Đơn không ở trạng thái có thể hủy", body.GetProperty("disableReason").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 6. PAYMENT: NO_PAYMENT
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldReturnCanCancel_WithNoPaymentRefund_WhenPendingAndNoPayments()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "PENDING", FinalAmount = 1000,
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: true, cancelBeforeMinutes: 60),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) } }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.True(body.GetProperty("canCancel").GetBoolean());
        Assert.Equal("NO_PAYMENT", body.GetProperty("cancelBranch").GetString());
        
        var payment = body.GetProperty("payment");
        Assert.False(payment.GetProperty("hasProof").GetBoolean());
        Assert.False(payment.GetProperty("paymentConfirmed").GetBoolean());

        var refund = body.GetProperty("refund");
        Assert.Equal(0, refund.GetProperty("refundAmount").GetDecimal());
        Assert.Equal(0, refund.GetProperty("penaltyAmount").GetDecimal());
    }

    // ══════════════════════════════════════════════════════════
    // 7. PAYMENT: PROOF_UPLOADED
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldEstimateRefund_WhenProofUploadedButStatusPending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "PENDING", FinalAmount = 1000,
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: true, cancelBeforeMinutes: 60, refundType: "PERCENT", refundPercent: 80),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) } },
            Payments = new List<Payment> 
            {
                new Payment { Id = Guid.NewGuid(), Status = "PENDING", Amount = 1000, GatewayReference = "https://proof.png" }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.True(body.GetProperty("canCancel").GetBoolean());
        Assert.Equal("PROOF_UPLOADED", body.GetProperty("cancelBranch").GetString());
        
        var payment = body.GetProperty("payment");
        Assert.True(payment.GetProperty("hasProof").GetBoolean());
        Assert.False(payment.GetProperty("paymentConfirmed").GetBoolean());
        Assert.Equal(1000, payment.GetProperty("pendingPaymentAmount").GetDecimal());

        var refund = body.GetProperty("refund");
        Assert.Equal(800, refund.GetProperty("refundAmount").GetDecimal()); // 80% of 1000
        Assert.Equal(200, refund.GetProperty("penaltyAmount").GetDecimal());
        Assert.Contains("ước tính", refund.GetProperty("refundEstimateNote").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 8. PAYMENT: PAID
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CancelPreview_ShouldCalculateRefund_WhenPaymentConfirmed()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, Status = "CONFIRMED", FinalAmount = 1000,
            CancellationPolicySnapshotJson = PolicyJson(allowCancel: true, cancelBeforeMinutes: 60, refundType: "FULL"),
            BookingItems = new List<BookingItem> { new BookingItem { StartTime = DateTime.UtcNow.AddDays(1) } },
            Payments = new List<Payment> 
            {
                new Payment { Id = Guid.NewGuid(), Status = "COMPLETED", Amount = 1000 }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.CancelPreview(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);

        Assert.True(body.GetProperty("canCancel").GetBoolean());
        Assert.Equal("PAID", body.GetProperty("cancelBranch").GetString());
        
        var payment = body.GetProperty("payment");
        Assert.True(payment.GetProperty("paymentConfirmed").GetBoolean());
        Assert.Equal(1000, payment.GetProperty("paidAmount").GetDecimal());

        var refund = body.GetProperty("refund");
        Assert.Equal(1000, refund.GetProperty("refundAmount").GetDecimal()); // FULL refund
        Assert.Equal(0, refund.GetProperty("penaltyAmount").GetDecimal());
        Assert.Null(refund.GetProperty("refundEstimateNote").GetString());
    }
}

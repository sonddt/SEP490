using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerGetPaymentContextTests
{
    private BookingsController CreateController(
        ShuttleUpDbContext dbContext,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockLifecycle = new Mock<IMatchingPostLifecycleService>();

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

    private class ErrorMessageResponse 
    { 
        public string Message { get; set; } = ""; 
        public string? Code { get; set; }
    }

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPaymentContext_ShouldReturnUnauthorizedOrNotFound_WhenAccessRightsViolated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid();
        var bookingOwnerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, UserId = bookingOwnerId });
        await db.SaveChangesAsync();

        // 1. Anonymous Access
        var controllerAnon = CreateController(db, loggedInUserId: null);
        var resAnon = await controllerAnon.GetPaymentContext(bookingId);
        Assert.IsType<UnauthorizedObjectResult>(resAnon);

        // 2. Extraneous Alien Actor (Trying to steal another player's payment metadata)
        var controllerAlien = CreateController(db, loggedInUserId: alienUserId);
        var resAlien = await controllerAlien.GetPaymentContext(bookingId);
        Assert.IsType<NotFoundObjectResult>(resAlien); 
        // Notice it returns NotFound instead of Forbid because it uses `b.UserId == me` in the EF Match!
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE LOCKS & STATUS METRICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPaymentContext_ShouldReturnBadRequest_WhenStatusInvalidOrHoldExpired()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();

        // Invalid Scenario A: Status is essentially already paid or terminated
        var confirmedBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CONFIRMED" };
        var cancelledBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CANCELLED" };

        // Invalid Scenario B: Holding bounds expired visually
        var expiredHoldingBooking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), 
            UserId = memberId, 
            Status = "HOLDING", 
            HoldExpiresAt = DateTime.UtcNow.AddMinutes(-5) 
        };

        db.Bookings.AddRange(confirmedBooking, cancelledBooking, expiredHoldingBooking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Run Trap A
        var r1 = await controller.GetPaymentContext(confirmedBooking.Id);
        Assert.Contains("trạng thái", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        var r2 = await controller.GetPaymentContext(cancelledBooking.Id);
        Assert.IsType<BadRequestObjectResult>(r2);

        // Run Trap B
        var r3 = await controller.GetPaymentContext(expiredHoldingBooking.Id);
        var err3 = ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r3).Value);
        Assert.Contains("thời gian giữ chỗ đã hết", err3.Message.ToLowerInvariant());
        Assert.Equal("HOLD_EXPIRED", err3.Code);
    }

    // ══════════════════════════════════════════════════════════
    // 3. UI MAPPING & COMPLEX DEDUCTION METRICS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetPaymentContext_ShouldMapFormatStringValuesAndResolvePaymentProofProperly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var baseTime = DateTime.UtcNow;

        var venue = new Venue { Id = Guid.NewGuid(), Name = "Master Arena" };
        
        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId,
            UserId = memberId,
            VenueId = venue.Id,
            Venue = venue,
            Status = "PENDING",
            ContactName = "Huy Tran",
            FinalAmount = 150000
        };

        // UI String Mapper bounds: System computes `.Count * 30 mins`. 
        // Three Items = 90 mins = "1h30" format string test.
        booking.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = baseTime });
        booking.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = baseTime.AddMinutes(30) });
        booking.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = baseTime.AddMinutes(60) });

        // Proof computation bounds: The newest logged payment is analyzed for a gateway string
        var oldBadPayment = new Payment 
        { 
            Id = Guid.NewGuid(), BookingId = bookingId, 
            GatewayReference = "invalid-string", CreatedAt = baseTime.AddDays(-1) 
        };
        var newGoodPayment = new Payment 
        { 
            Id = Guid.NewGuid(), BookingId = bookingId, 
            GatewayReference = "https://cloudinary.com/proof", CreatedAt = baseTime 
        };
        booking.Payments.Add(oldBadPayment);
        booking.Payments.Add(newGoodPayment);

        db.Venues.Add(venue);
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var result = await controller.GetPaymentContext(bookingId);
        var ok = Assert.IsType<OkObjectResult>(result);

        var returnObj = ReadPayload<JsonElement>(ok.Value);

        // Struct Asserts!
        Assert.Equal("Master Arena", returnObj.GetProperty("venueName").GetString());
        Assert.Equal("Huy Tran", returnObj.GetProperty("customerName").GetString());
        Assert.Equal(150000, returnObj.GetProperty("totalPrice").GetDecimal());
        
        // Assert mathematical calculation string conversion ('h' notation format)
        Assert.Equal("1h30", returnObj.GetProperty("totalHours").GetString());

        // Assert payment proof inference lock 
        Assert.True(returnObj.GetProperty("hasValidPaymentProof").GetBoolean());
    }
}

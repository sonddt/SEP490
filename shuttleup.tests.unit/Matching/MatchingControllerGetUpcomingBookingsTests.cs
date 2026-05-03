using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerGetUpcomingBookingsTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockActivity = new Mock<IMatchingPostActivityService>();

        var controller = new MatchingController(
            dbContext,
            mockNotify.Object,
            mockFile.Object,
            mockActivity.Object
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

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetUpcomingBookings_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.GetUpcomingBookings();
        Assert.IsType<UnauthorizedResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE, OWNERSHIP, AND STATUS FILTERING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetUpcomingBookings_ShouldFilterOutForeignCancelledAndInherentlyPastBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();

        // VALID: Mine, Confirmed, Status is Future
        var b1 = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = myUserId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };
        b1.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(2) });

        // INVALID: Foreign Ownership
        var b2 = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };
        b2.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(2) });

        // INVALID: Not Confirmed (e.g. Cancelled)
        var b3 = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = myUserId, Status = "CANCELLED", CreatedAt = DateTime.UtcNow };
        b3.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(2) });

        // INVALID: Past Start Times
        var b4 = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = myUserId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };
        b4.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(-2) });

        db.Bookings.AddRange(b1, b2, b3, b4);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.GetUpcomingBookings();
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<List<JsonElement>>(ok.Value);

        // Core Assertion: EF Core `.Where()` dropped constraints 2, 3, and 4 effectively bridging only Booking 1!
        Assert.Single(data);
        Assert.Equal(b1.Id.ToString(), data[0].GetProperty("id").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 3. CAPACITANCE CLAMPING AND EXPIRATION SUB-SLOT FILTERS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetUpcomingBookings_ShouldClampResultsToTop20_AndFilterOutExpiredSubItemsInsideActiveBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        
        // Load 25 Valid Bookings to verify `.Take(20)` pagination clamping
        for (int i = 0; i < 25; i++)
        {
            var b = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = myUserId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddMinutes(i) };
            b.BookingItems.Add(new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(2) });
            db.Bookings.Add(b);
        }

        // Add 1 VERY SPECIAL Booking: It holds both a PAST slot and a FUTURE slot (Meaning the booking is valid actively)
        var specialBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = myUserId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddDays(1) /* Guarantee it sorts first */ };
        var pastSlot = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(-1), FinalPrice = 4000 };
        var futureSlot = new BookingItem { Id = Guid.NewGuid(), StartTime = DateTime.UtcNow.AddHours(1), FinalPrice = 5000 };
        specialBooking.BookingItems.Add(pastSlot);
        specialBooking.BookingItems.Add(futureSlot);
        db.Bookings.Add(specialBooking);

        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: myUserId);

        var result = await controller.GetUpcomingBookings();
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<List<JsonElement>>(ok.Value);

        // Capacitance Assert: EF Core `.Take(20)` slices the 26 total bookings cleanly!
        Assert.Equal(20, data.Count);

        // Subsurface Assertion: Check the newest (Special) Booking
        var specialDataNode = data.First(d => d.GetProperty("id").GetString() == specialBooking.Id.ToString());
        var mappedItemsArray = specialDataNode.GetProperty("items");

        // The parent booking was fetched because it had AT LEAST one future slot. 
        // BUT the internal `.Select()` map must have structurally dropped the `pastSlot` entirely!
        Assert.Equal(1, mappedItemsArray.GetArrayLength());
        var singlePassedItem = mappedItemsArray[0];
        Assert.Equal(5000m, singlePassedItem.GetProperty("price").GetDecimal());
    }
}

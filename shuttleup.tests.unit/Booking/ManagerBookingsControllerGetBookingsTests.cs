using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class ManagerBookingsControllerGetBookingsTests
{
    private ManagerBookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();
        return new ManagerBookingsController(dbContext, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class GetBookingsResponse
    {
        public Guid BookingId { get; set; }
        public string? BookingCode { get; set; }
        public string? Status { get; set; }
        public Guid? SeriesId { get; set; }
        public bool IsLongTerm { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? VenueName { get; set; }
        public string? PlayerName { get; set; }
        public string? PlayerAvatarUrl { get; set; }
        public string? PaymentStatus { get; set; }
        public string? ContactPhone { get; set; }
        public string? PlayerPhone { get; set; }
        public List<GetBookingsItemDto> Items { get; set; } = new();
    }

    private class GetBookingsItemDto
    {
        public string? CourtName { get; set; }
        public string? CourtImageUrl { get; set; }
    }

    private static List<GetBookingsResponse> ReadListPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<List<GetBookingsResponse>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. UNAUTHORIZED
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetBookings_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetBookings(null);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. DATA ISOLATION (OWNERSHIP & EXCLUDE HOLDING)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetBookings_ShouldOnlyReturnBookingsForManagersVenues_AndIgnoreHolding()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();

        var myVenueId = Guid.NewGuid();
        var otherVenueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = myVenueId, OwnerUserId = managerId, Name = "MyVenue" });
        db.Venues.Add(new Venue { Id = otherVenueId, OwnerUserId = otherManagerId, Name = "OtherVenue" });

        // Valid booking for current manager
        var myBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "PENDING", CreatedAt = DateTime.UtcNow };
        db.Bookings.Add(myBooking);
        
        // HOLDING booking for current manager (Should be ignored)
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "HOLDING", CreatedAt = DateTime.UtcNow });
        
        // Booking for another manager (Should be ignored)
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = otherVenueId, Status = "PENDING", CreatedAt = DateTime.UtcNow });
        
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetBookings(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);

        Assert.Single(data);
        Assert.Equal(myBooking.Id, data[0].BookingId);
    }

    // ══════════════════════════════════════════════════════════
    // 3. FILTERING BY STATUS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetBookings_ShouldFilterByStatus_WhenValidStatusProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var myVenueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = myVenueId, OwnerUserId = managerId });

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddMinutes(-5) });
        var confirmedBooking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };
        db.Bookings.Add(confirmedBooking);

        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Case-insensitive trimming filter test
        var result = await controller.GetBookings("  coNfirMeD  ");

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);

        Assert.Single(data);
        Assert.Equal(confirmedBooking.Id, data[0].BookingId);
    }

    [Fact]
    public async Task GetBookings_ShouldIgnoreInvalidStatusFilter_AndReturnAllNonHolding()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var myVenueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = myVenueId, OwnerUserId = managerId });

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddMinutes(-5) });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow });

        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetBookings("INVALID_FAKE_STATUS");

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);

        Assert.Equal(2, data.Count);
    }

    // ══════════════════════════════════════════════════════════
    // 4. ORDERING
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetBookings_ShouldOrderResultsByCreatedAtDescending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var myVenueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = myVenueId, OwnerUserId = managerId });

        var older = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddDays(-2) };
        var newer = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = myVenueId, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };

        db.Bookings.Add(older);
        db.Bookings.Add(newer);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetBookings(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);

        Assert.Equal(2, data.Count);
        Assert.Equal(newer.Id, data[0].BookingId);
        Assert.Equal(older.Id, data[1].BookingId);
    }

    // ══════════════════════════════════════════════════════════
    // 5. COMPLEX MAPPING (PaymentStatus, Avatar, Code, Items)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetBookings_ShouldMapComplexEntitiesCorrectly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var avatarFileId = Guid.NewGuid();
        var courtFileId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = avatarFileId, FileUrl = "http://avatar.jpg" });
        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = courtFileId, FileUrl = "http://court.jpg" });
        
        db.Users.Add(new User { Id = playerId, FullName = "John Doe", PhoneNumber = "0987", AvatarFileId = avatarFileId });
        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId, Name = "V" });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, Name = "Court1", Files = new List<ShuttleUp.DAL.Models.File> { db.Files.Find(courtFileId)! } });

        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId,
            VenueId = venueId,
            UserId = playerId,
            Status = "PENDING",
            ContactPhone = "0123", // Given priority over User.PhoneNumber
            TotalAmount = 50000,
            FinalAmount = null,
            CreatedAt = DateTime.UtcNow,
            SeriesId = Guid.NewGuid(), // Marks as long-term
            BookingItems = new List<BookingItem>
            {
                new BookingItem { Id = Guid.NewGuid(), CourtId = courtId, StartTime = DateTime.UtcNow }
            },
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), Status = "COMPLETED", CreatedAt = DateTime.UtcNow }
            }
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetBookings(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);

        Assert.Single(data);
        var res = data[0];

        var expectedCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        Assert.Equal(expectedCode, res.BookingCode);
        Assert.True(res.IsLongTerm);
        Assert.Equal(booking.SeriesId, res.SeriesId);
        Assert.Equal(50000, res.TotalAmount); // Fallback to TotalAmount
        
        Assert.Equal("John Doe", res.PlayerName);
        Assert.Equal("0123", res.PlayerPhone); // Priority over User phone
        Assert.Equal("http://avatar.jpg", res.PlayerAvatarUrl); // Mapped via User -> AvatarFile -> FileUrl

        Assert.Equal("PAID", res.PaymentStatus); // Evaluated via Payments

        Assert.Single(res.Items);
        Assert.Equal("Court1", res.Items[0].CourtName);
        Assert.Equal("http://court.jpg", res.Items[0].CourtImageUrl); // Mapped via Court -> Files -> First() -> FileUrl
    }
}

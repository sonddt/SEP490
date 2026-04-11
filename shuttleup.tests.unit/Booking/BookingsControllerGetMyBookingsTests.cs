using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerGetMyBookingsTests
{
    private BookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockFileService = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();
        return new BookingsController(dbContext, mockFileService.Object, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private class BookingRow
    {
        public Guid Id { get; set; }
        public string? BookingCode { get; set; }
        public string? Status { get; set; }
        public decimal? TotalAmount { get; set; }
        public decimal? FinalAmount { get; set; }
        public DateTime? CreatedAt { get; set; }
        public Guid? SeriesId { get; set; }
        public bool IsLongTerm { get; set; }
        public string? VenueName { get; set; }
        public string? VenueAddress { get; set; }
        public Guid? VenueId { get; set; }
        public string? RefundStatus { get; set; }
        public bool CanReview { get; set; }
        public bool CanEditReview { get; set; }
        public bool NeedsPaymentRetry { get; set; }
        public bool HasValidPaymentProof { get; set; }
    }

    private static List<BookingRow> ReadListPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<List<BookingRow>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private static ShuttleUp.DAL.Models.Booking SeedBooking(
        ShuttleUpDbContext db, Guid userId, Guid venueId,
        string status = "PENDING", DateTime? createdAt = null, Guid? seriesId = null)
    {
        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = venueId,
            Status = status,
            TotalAmount = 200000,
            FinalAmount = 180000,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            SeriesId = seriesId,
        };
        db.Bookings.Add(booking);
        return booking;
    }

    // ════════════════════════════════════════════════════
    //  1. UNAUTHORIZED
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetMyBookings();

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ════════════════════════════════════════════════════
    //  2. EMPTY — no bookings for user
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldReturnEmptyList_WhenUserHasNoBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);
        Assert.Empty(list);
    }

    // ════════════════════════════════════════════════════
    //  3. OWNERSHIP — only returns current user's bookings
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldReturnOnlyCurrentUsersBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        var myBooking = SeedBooking(db, myUserId, venueId, "PENDING");
        SeedBooking(db, otherUserId, venueId, "CONFIRMED");
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, myUserId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Single(list);
        Assert.Equal(myBooking.Id, list[0].Id);
    }

    // ════════════════════════════════════════════════════
    //  4. ORDERING — newest first (CreatedAt DESC)
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldOrderByCreatedAtDescending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        var older = SeedBooking(db, userId, venueId, "CONFIRMED", DateTime.UtcNow.AddDays(-5));
        var newer = SeedBooking(db, userId, venueId, "PENDING", DateTime.UtcNow.AddDays(-1));
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Equal(2, list.Count);
        Assert.Equal(newer.Id, list[0].Id);
        Assert.Equal(older.Id, list[1].Id);
    }

    // ════════════════════════════════════════════════════
    //  5. RESPONSE SHAPE — bookingCode, isLongTerm, venue info
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldReturnCorrectBookingCode()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "MyVenue", Address = "123 Street", IsActive = true });
        var booking = SeedBooking(db, userId, venueId, "PENDING");
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Single(list);
        var expectedCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        Assert.Equal(expectedCode, list[0].BookingCode);
        Assert.Equal("MyVenue", list[0].VenueName);
        Assert.Equal("123 Street", list[0].VenueAddress);
        Assert.Equal(venueId, list[0].VenueId);
    }

    [Fact]
    public async Task GetMyBookings_ShouldSetIsLongTermTrue_WhenSeriesIdNotNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        db.BookingSeries.Add(new BookingSeries { Id = seriesId, UserId = userId, VenueId = venueId, Status = "ACTIVE", CreatedAt = DateTime.UtcNow });
        SeedBooking(db, userId, venueId, "PENDING", seriesId: seriesId);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Single(list);
        Assert.True(list[0].IsLongTerm);
        Assert.Equal(seriesId, list[0].SeriesId);
    }

    [Fact]
    public async Task GetMyBookings_ShouldSetIsLongTermFalse_WhenSeriesIdNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        SeedBooking(db, userId, venueId, "PENDING");
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Single(list);
        Assert.False(list[0].IsLongTerm);
        Assert.Null(list[0].SeriesId);
    }

    // ════════════════════════════════════════════════════
    //  6. SIDE-EFFECT FREE — read-only, no mutation
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldNotMutateAnyData()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        SeedBooking(db, userId, venueId, "CONFIRMED");
        await db.SaveChangesAsync();

        var bookingCountBefore = db.Bookings.Count();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        await controller.GetMyBookings();
        await controller.GetMyBookings(); // repeated

        Assert.Equal(bookingCountBefore, db.Bookings.Count());
    }

    // ════════════════════════════════════════════════════
    //  7. BUSINESS LOGIC — canReview / needsPaymentRetry
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ShouldSetNeedsPaymentRetryTrue_WhenPendingAndNoValidProof()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        SeedBooking(db, userId, venueId, "PENDING");
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyBookings();

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = ReadListPayload(ok.Value);

        Assert.Single(list);
        Assert.True(list[0].NeedsPaymentRetry);
        Assert.False(list[0].HasValidPaymentProof);
    }
}

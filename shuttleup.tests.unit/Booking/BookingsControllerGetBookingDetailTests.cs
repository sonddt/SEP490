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

/// <summary>
/// Tests for BookingsController.GetMyBookings — the player-side "booking detail" feed.
/// The controller has NO separate GET /{id} detail endpoint on the player side;
/// detail is embedded in the GetMyBookings list payload (bookingCode, items,
/// refundStatus, canReview, etc.), confirmed by reading the source.
/// These tests supplement the existing GetMyBookingsTests with deeper coverage
/// of the per-booking computed fields.
/// </summary>
public class BookingsControllerGetBookingDetailTests
{
    private BookingsController CreateController(ShuttleUpDbContext db, Guid userId)
    {
        var mockFile = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockLifecycle = new Mock<IMatchingPostLifecycleService>();

        var controller = new BookingsController(db, mockFile.Object, mockNotify.Object, mockLifecycle.Object);
        ControllerTestHelper.SetUser(controller, userId);
        return controller;
    }

    private static T ReadFirst<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var list = JsonSerializer.Deserialize<List<T>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
        return list[0];
    }

    private class BookingDetailRow
    {
        public Guid Id { get; set; }
        public string? BookingCode { get; set; }
        public string? Status { get; set; }
        public string? RefundStatus { get; set; }
        public decimal? RefundAmount { get; set; }
        public string? RefundBankName { get; set; }
        public string? RefundAccountNumber { get; set; }
        public string? RefundAccountHolder { get; set; }
        public Guid? VenueReviewId { get; set; }
        public bool CanReview { get; set; }
        public bool CanEditReview { get; set; }
        public bool NeedsPaymentRetry { get; set; }
        public bool HasValidPaymentProof { get; set; }
        public DateTime? ReviewWindowEndsAt { get; set; }
        public bool IsLongTerm { get; set; }
        public Guid? SeriesId { get; set; }
    }

    // ══════════════════════════════════════════════════════════════════
    // 1. BOOKING CODE FORMAT — "SU" + last 6 of GUID in uppercase
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_BookingCode_ShouldFollowSUFormatWithLast6OfGuid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };

        db.Venues.Add(venue);
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId, UserId = userId, VenueId = venue.Id,
            Status = "PENDING", CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var row = ReadFirst<BookingDetailRow>(ok.Value);

        var expected = "SU" + bookingId.ToString("N")[^6..].ToUpperInvariant();
        Assert.Equal(expected, row.BookingCode);
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. PAYMENT PROOF FLAG — hasValidPaymentProof driven by HTTPS reference
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_HasValidPaymentProof_ShouldBeTrueOnlyForHttpsGatewayReference()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        // Booking A — has a proper HTTPS proof
        var bA = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddSeconds(-1) };
        bA.Payments.Add(new Payment { Status = "PENDING", GatewayReference = "https://cdn.example.com/proof.jpg" });

        // Booking B — has an HTTP (non-secure) reference → invalid
        var bB = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "PENDING", CreatedAt = DateTime.UtcNow };
        bB.Payments.Add(new Payment { Status = "PENDING", GatewayReference = "http://insecure.example.com/proof.jpg" });

        db.Bookings.AddRange(bA, bB);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());

        var json = JsonSerializer.Serialize(ok.Value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var rows = JsonSerializer.Deserialize<List<BookingDetailRow>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;

        var rowB = rows.First(r => r.Id == bB.Id);
        var rowA = rows.First(r => r.Id == bA.Id);

        Assert.True(rowA.HasValidPaymentProof);
        Assert.False(rowB.HasValidPaymentProof);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. NEEDS PAYMENT RETRY — PENDING status without valid proof
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_NeedsPaymentRetry_ShouldBeTrue_OnlyWhenPendingWithoutProof()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        var bPendingNoProof = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddSeconds(-2) };
        var bPendingWithProof = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "PENDING", CreatedAt = DateTime.UtcNow.AddSeconds(-1) };
        bPendingWithProof.Payments.Add(new Payment { Status = "PENDING", GatewayReference = "https://cdn.example.com/proof.jpg" });
        var bConfirmed = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow };

        db.Bookings.AddRange(bPendingNoProof, bPendingWithProof, bConfirmed);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var json = JsonSerializer.Serialize(ok.Value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var rows = JsonSerializer.Deserialize<List<BookingDetailRow>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;

        Assert.True(rows.First(r => r.Id == bPendingNoProof.Id).NeedsPaymentRetry);
        Assert.False(rows.First(r => r.Id == bPendingWithProof.Id).NeedsPaymentRetry);
        Assert.False(rows.First(r => r.Id == bConfirmed.Id).NeedsPaymentRetry);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. CAN REVIEW — CONFIRMED + within 3-day window + no review yet
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_CanReview_ShouldBeTrue_OnlyForConfirmedWithin3DaysWithNoReviewYet()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        // Booking A: CONFIRMED, created 1 day ago → within window, no review
        var bA = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddDays(-1) };
        // Booking B: CONFIRMED, created 4 days ago → OUTSIDE window
        var bB = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddDays(-4) };
        // Booking C: CONFIRMED, created 1 day ago → within window but already reviewed
        var bC = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddDays(-1) };

        db.Bookings.AddRange(bA, bB, bC);

        // Attach existing review to Booking C
        db.VenueReviews.Add(new VenueReview { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, BookingId = bC.Id, Rating = 5 });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var json = JsonSerializer.Serialize(ok.Value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var rows = JsonSerializer.Deserialize<List<BookingDetailRow>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;

        Assert.True(rows.First(r => r.Id == bA.Id).CanReview);      // Within window, no review
        Assert.False(rows.First(r => r.Id == bB.Id).CanReview);     // Beyond 3-day window
        Assert.False(rows.First(r => r.Id == bC.Id).CanReview);     // Already reviewed
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. CAN EDIT REVIEW — CONFIRMED + within window + HAS review
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_CanEditReview_ShouldBeTrue_WhenReviewExistsAndWithin3DayWindow()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = DateTime.UtcNow.AddHours(-2) };
        db.Bookings.Add(booking);
        db.VenueReviews.Add(new VenueReview { Id = reviewId, UserId = userId, VenueId = venue.Id, BookingId = booking.Id, Rating = 4 });
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var row = ReadFirst<BookingDetailRow>(ok.Value);

        Assert.False(row.CanReview);          // Already reviewed → cannot create new
        Assert.True(row.CanEditReview);       // Has review within window → can edit
        Assert.Equal(reviewId, row.VenueReviewId);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. REFUND STATUS projected from RefundRequests (latest one)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_RefundStatus_ShouldReflectLatestRefundRequest()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "PENDING_REFUND", CreatedAt = DateTime.UtcNow };
        db.Bookings.Add(booking);

        // Two refund requests — latest should be selected
        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, UserId = userId, Status = "PENDING_REFUND", RequestedAmount = 150000, RequestedAt = DateTime.UtcNow.AddHours(-2), RefundBankName = "Old Bank" });
        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, UserId = userId, Status = "PENDING_REFUND", RequestedAmount = 200000, RequestedAt = DateTime.UtcNow, RefundBankName = "Vietcombank", RefundAccountNumber = "99990000", RefundAccountHolder = "NGUYEN VAN A" });

        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var row = ReadFirst<BookingDetailRow>(ok.Value);

        Assert.Equal("PENDING_REFUND", row.RefundStatus);
        Assert.Equal(200000, row.RefundAmount);
        Assert.Equal("Vietcombank", row.RefundBankName);
        Assert.Equal("99990000", row.RefundAccountNumber);
        Assert.Equal("NGUYEN VAN A", row.RefundAccountHolder);
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. LONG TERM FLAG — isLongTerm + seriesId pass-through
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_IsLongTerm_ShouldMatchSeriesIdPresence()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);
        db.BookingSeries.Add(new BookingSeries { Id = seriesId, UserId = userId, VenueId = venue.Id, Status = "ACTIVE" });

        var longTerm = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", SeriesId = seriesId, CreatedAt = DateTime.UtcNow };
        var single   = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", SeriesId = null,     CreatedAt = DateTime.UtcNow.AddSeconds(-1) };

        db.Bookings.AddRange(longTerm, single);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var json = JsonSerializer.Serialize(ok.Value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        var rows = JsonSerializer.Deserialize<List<BookingDetailRow>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;

        var lt = rows.First(r => r.Id == longTerm.Id);
        var st = rows.First(r => r.Id == single.Id);

        Assert.True(lt.IsLongTerm);
        Assert.Equal(seriesId, lt.SeriesId);

        Assert.False(st.IsLongTerm);
        Assert.Null(st.SeriesId);
    }

    // ══════════════════════════════════════════════════════════════════
    // 8. REVIEW WINDOW END — exactly CreatedAt + 3 days
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMyBookings_ReviewWindowEndsAt_ShouldBeCreatedAtPlusThreDays()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venue = new Venue { Id = Guid.NewGuid(), Name = "V" };
        db.Venues.Add(venue);

        var created = new DateTime(2025, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = userId, VenueId = venue.Id, Status = "CONFIRMED", CreatedAt = created };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var controller = CreateController(db, userId);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetMyBookings());
        var row = ReadFirst<BookingDetailRow>(ok.Value);

        var expectedWindow = created.AddDays(3);
        Assert.Equal(expectedWindow, row.ReviewWindowEndsAt?.ToUniversalTime());
    }
}

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Refunds;

public class ManagerRefundsControllerGetRefundRequestsTests
{
    private ManagerRefundsController CreateController(ShuttleUpDbContext db, INotificationDispatchService? notify = null, IFileService? fileService = null)
    {
        var mockNotify = notify != null ? Mock.Get(notify) : new Mock<INotificationDispatchService>();
        var mockFileService = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();

        return new ManagerRefundsController(db, mockNotify.Object, mockFileService.Object);
    }

    private class GetRefundsResponseDto
    {
        public Guid RefundRequestId { get; set; }
        public Guid BookingId { get; set; }
        public string? BookingCode { get; set; }
        public string? BookingStatus { get; set; }
        public string? VenueName { get; set; }
        public string? PlayerName { get; set; }
        public string? PlayerPhone { get; set; }
        public string? RefundStatus { get; set; }
        public string? ReasonCode { get; set; }
        public decimal? RequestedAmount { get; set; }
        public decimal? PaidAmount { get; set; }
        public decimal? FinalAmount { get; set; }
        public string? ManagerEvidenceUrl { get; set; }
        public string? PaymentProofUrl { get; set; }
    }

    private static List<GetRefundsResponseDto> ReadListPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<List<GetRefundsResponseDto>>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION / MULTI-TENANT BOUNDARY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetRefundRequests_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetRefundRequests(null);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task GetRefundRequests_ShouldReturnEmpty_WhenManagerHasNoVenues()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Manager has zero venues

        var result = await controller.GetRefundRequests(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);
        Assert.Empty(data);
    }

    [Fact]
    public async Task GetRefundRequests_ShouldOnlyReturnRefundsForVenuesOwnedByManager()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        
        var venueMy = Guid.NewGuid();
        var venueOther = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueMy, OwnerUserId = managerId });
        db.Venues.Add(new Venue { Id = venueOther, OwnerUserId = otherManagerId });

        var bookingMy = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueMy };
        var bookingOther = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueOther };
        db.Bookings.Add(bookingMy);
        db.Bookings.Add(bookingOther);

        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingMy.Id });
        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingOther.Id }); // Belonging to other manager
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetRefundRequests(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);
        
        Assert.Single(data);
        Assert.Equal(bookingMy.Id, data[0].BookingId);
    }

    // ══════════════════════════════════════════════════════════
    // 2. QUERY FILTRATION (Status)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetRefundRequests_ShouldFilterByStatus_WhenStatusQueryIsProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId };
        db.Bookings.Add(booking);

        var refundPending = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "PENDING_REFUND" };
        var refundCompleted = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id, Status = "COMPLETED" };
        db.RefundRequests.Add(refundPending);
        db.RefundRequests.Add(refundCompleted);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Case insensitive format checking
        var result = await controller.GetRefundRequests("  comPLEted ");

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadListPayload(ok.Value);
        
        Assert.Single(data);
        Assert.Equal(refundCompleted.Id, data[0].RefundRequestId);
    }

    // ══════════════════════════════════════════════════════════
    // 3. COMPLEX MAPPING & JOINS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetRefundRequests_ShouldMapComplexRelationshipsProperly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var testFileId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = testFileId, FileUrl = "http://ManagerEvidenceCloud.jpg" });
        db.Users.Add(new User { Id = playerId, FullName = "Refund Player", PhoneNumber = "0112233" });
        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId, Name = "Refund Venue" });
        
        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), 
            VenueId = venueId,
            UserId = playerId,
            Status = "PENDING_REFUND",
            ContactPhone = "0999999", // Overrides user phone
            FinalAmount = 250000,
            Payments = new List<Payment>
            {
                new Payment { Id = Guid.NewGuid(), GatewayReference = "http://PaymentProofCloud.jpg", CreatedAt = DateTime.UtcNow }
            }
        };
        db.Bookings.Add(booking);

        var refund = new RefundRequest 
        { 
            Id = Guid.NewGuid(), 
            BookingId = booking.Id,
            UserId = playerId,
            Status = "COMPLETED",
            RequestedAmount = 150000,
            PaidAmount = 250000,
            ManagerEvidenceFileId = testFileId,
            RequestedAt = DateTime.UtcNow
        };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetRefundRequests(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var res = ReadListPayload(ok.Value).First();

        var expectedCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        Assert.Equal(expectedCode, res.BookingCode);
        Assert.Equal("Refund Venue", res.VenueName);
        Assert.Equal("Refund Player", res.PlayerName);
        Assert.Equal("0999999", res.PlayerPhone); // Assert contactPhone overrides User account phone correctly
        
        Assert.Equal(150000, res.RequestedAmount);
        Assert.Equal(250000, res.PaidAmount);
        Assert.Equal(250000, res.FinalAmount);

        Assert.Equal("http://ManagerEvidenceCloud.jpg", res.ManagerEvidenceUrl);
        Assert.Equal("http://PaymentProofCloud.jpg", res.PaymentProofUrl);
    }
}

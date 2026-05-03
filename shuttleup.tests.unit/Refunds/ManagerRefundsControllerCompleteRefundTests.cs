using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Refunds;

public class ManagerRefundsControllerCompleteRefundTests
{
    private ManagerRefundsController CreateController(ShuttleUpDbContext db, INotificationDispatchService? notify = null, IFileService? fileService = null)
    {
        var mockNotify = notify != null ? Mock.Get(notify) : new Mock<INotificationDispatchService>();
        var mockFileService = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();

        return new ManagerRefundsController(db, mockNotify.Object, mockFileService.Object);
    }

    public static IFormFile CreateMockFormFile(string fileName, string contentType, long length)
    {
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns(fileName);
        mockFile.Setup(f => f.ContentType).Returns(contentType);
        mockFile.Setup(f => f.Length).Returns(length);
        mockFile.Setup(f => f.OpenReadStream()).Returns(new MemoryStream(new byte[length]));
        return mockFile.Object;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }



    // ══════════════════════════════════════════════════════════
    // PART 2: COMPLETE REFUND
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CompleteRefund_ShouldReturnForbid_WhenVenueOwnedByOther()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = Guid.NewGuid() }); // Wrong Owner
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId });
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = db.Bookings.First().Id };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.CompleteRefund(refund.Id, null);
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task CompleteRefund_ShouldReturnBadRequest_WhenStatusNotPendingRefund()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId });
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = db.Bookings.First().Id, Status = "PENDING_RECONCILIATION" }; // WRONG STATE
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.CompleteRefund(refund.Id, null);
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("trạng thái chờ hoàn tiền", ReadPayload<ErrorMessageResponse>(bad.Value).Message);
    }

    [Fact]
    public async Task CompleteRefund_ShouldReturnBadRequest_WhenNoEvidenceUploaded()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId });
        
        // PENDING_REFUND but ManagerEvidenceFileId IS NULL
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = db.Bookings.First().Id, Status = "PENDING_REFUND", ManagerEvidenceFileId = null };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.CompleteRefund(refund.Id, null);
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("tải ảnh biên lai", ReadPayload<ErrorMessageResponse>(bad.Value).Message);
    }

    [Fact]
    public async Task CompleteRefund_ShouldSucceed_AndCascadeStatusUpdates_WhenEvidencePresent()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();
        var fileId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        db.BookingSeries.Add(new BookingSeries { Id = seriesId, Status = "ACTIVE" });
        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = fileId, FileUrl = "http://proof" });

        var booking = new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "PENDING_REFUND", SeriesId = seriesId
        };
        db.Bookings.Add(booking);

        var refund = new RefundRequest 
        { 
            Id = Guid.NewGuid(), BookingId = booking.Id, UserId = playerId,
            Status = "PENDING_REFUND", ManagerEvidenceFileId = fileId, RequestedAmount = 50000 
        };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        var controller = CreateController(db, mockNotify.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerRefundsController.CompleteRefundDto { ManagerNote = "Ck bằng Momo" };
        var result = await controller.CompleteRefund(refund.Id, dto);

        Assert.IsType<OkObjectResult>(result);

        // Assert updates
        var updatedRefund = db.RefundRequests.First(r => r.Id == refund.Id);
        Assert.Equal("COMPLETED", updatedRefund.Status);
        Assert.Equal("Ck bằng Momo", updatedRefund.ManagerNote);
        Assert.Equal(managerId, updatedRefund.ProcessedBy);

        var updatedBooking = db.Bookings.First(b => b.Id == booking.Id);
        Assert.Equal("REFUNDED", updatedBooking.Status);

        var updatedSeries = db.BookingSeries.First(s => s.Id == seriesId);
        Assert.Equal("REFUNDED", updatedSeries.Status);

        // Assert Notification
        mockNotify.Verify(n => n.NotifyUserAsync(
            playerId,
            "REFUND_COMPLETED",
            "Hoàn tiền thành công",
            It.Is<string>(s => s.Contains("50,000")),
            It.IsAny<object>(),
            true, // Send email
            It.IsAny<CancellationToken>()), Times.Once);
    }
}

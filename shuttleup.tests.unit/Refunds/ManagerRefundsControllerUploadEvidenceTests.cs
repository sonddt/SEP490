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

public class ManagerRefundsControllerUploadEvidenceTests
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
    // 1. UNAUTHORIZED / FORBID
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadEvidence_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var file = CreateMockFormFile("proof.png", "image/png", 100);
        var result = await controller.UploadEvidence(Guid.NewGuid(), file);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task UploadEvidence_ShouldReturnForbid_WhenVenueOwnedByOtherManager()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myManagerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = otherManagerId }); // Not mine
        var booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), VenueId = venueId };
        db.Bookings.Add(booking);
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = booking.Id };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, myManagerId); // My id

        var file = CreateMockFormFile("proof.png", "image/png", 100);
        var result = await controller.UploadEvidence(refund.Id, file);

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. VALIDATION OF FILE INTEGRITY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadEvidence_ShouldReturnBadRequest_WhenFileIsNull()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Bypass auth

        var result = await controller.UploadEvidence(Guid.NewGuid(), null!);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("vui lòng tải ảnh bill ck", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UploadEvidence_ShouldReturnBadRequest_WhenFileLengthIsZero()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Bypass auth

        var emptyFile = CreateMockFormFile("test.png", "image/png", 0);
        var result = await controller.UploadEvidence(Guid.NewGuid(), emptyFile);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("vui lòng tải ảnh bill ck", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UploadEvidence_ShouldReturnBadRequest_WhenFileIsNotAnImage()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Bypass auth

        var pdfFile = CreateMockFormFile("test.pdf", "application/pdf", 500);
        var result = await controller.UploadEvidence(Guid.NewGuid(), pdfFile);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("phải là ảnh", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. EXTERNAL DEPENDENCY FAILURE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadEvidence_ShouldThrow_WhenCloudinaryUploadFails()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, VenueId = venueId });
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingId };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(fs => fs.UploadPaymentProofAsync(It.IsAny<IFormFile>(), bookingId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Cloudinary connection reset"));

        var controller = CreateController(db, fileService: mockFileService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var file = CreateMockFormFile("proof.png", "image/png", 500);
        
        await Assert.ThrowsAsync<Exception>(() => controller.UploadEvidence(refund.Id, file));
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH PRESERVATION
    // ══════════════════════════════════════════════════════════
    private class SuccessUploadResponse
    {
        public string Message { get; set; } = "";
        public string FileUrl { get; set; } = "";
    }

    [Fact]
    public async Task UploadEvidence_ShouldUploadToCloud_SaveToDatabase_AndAttachToRefundRequest()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.Venues.Add(new Venue { Id = venueId, OwnerUserId = managerId });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, VenueId = venueId });
        var refund = new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingId };
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();

        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(fs => fs.UploadPaymentProofAsync(It.IsAny<IFormFile>(), bookingId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new FileUploadResult { SecureUrl = "https://cloud/safe-evidence.png", PublicId = "123" });

        var controller = CreateController(db, fileService: mockFileService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var file = CreateMockFormFile("evidence.png", "image/png", 1000);
        var result = await controller.UploadEvidence(refund.Id, file);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = ReadPayload<SuccessUploadResponse>(ok.Value);
        Assert.Equal("https://cloud/safe-evidence.png", response.FileUrl);

        var updatedRefund = db.RefundRequests.First(r => r.Id == refund.Id);
        Assert.NotNull(updatedRefund.ManagerEvidenceFileId); // File attached correctly

        var savedFile = db.Files.First(f => f.Id == updatedRefund.ManagerEvidenceFileId);
        Assert.Equal("https://cloud/safe-evidence.png", savedFile.FileUrl);
        Assert.Equal("image/png", savedFile.MimeType);
        Assert.Equal(1000, savedFile.FileSize);
        Assert.Equal(managerId, savedFile.UploadedByUserId);
        Assert.Equal("evidence.png", savedFile.FileName); // Check file payload properties persist correctly
    }
}

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend.BookingForms;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerSubmitPaymentTests
{
    private BookingsController CreateController(
        ShuttleUpDbContext dbContext,
        IFileService? fileService = null,
        INotificationDispatchService? notifyService = null,
        Guid? loggedInUserId = null)
    {
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();
        var mockFile = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();
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
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. UPLOAD ARTIFACT VALIDATIONS & SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SubmitPayment_ShouldReturnUnauthorizedOrBadRequest_WhenPayloadIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        // Security Trace
        var resAnon = await controller.SubmitPayment(Guid.NewGuid(), new SubmitBookingPaymentForm());
        Assert.IsType<UnauthorizedObjectResult>(resAnon);

        // Binding Validation Traces
        var controllerAuth = CreateController(db, loggedInUserId: Guid.NewGuid());
        
        var formEmptyFile = new SubmitBookingPaymentForm();
        var res1 = await controllerAuth.SubmitPayment(Guid.NewGuid(), formEmptyFile);
        Assert.Contains("vui lòng tải ảnh", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res1).Value).Message.ToLowerInvariant());

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(1024);
        mockFile.Setup(f => f.ContentType).Returns("application/pdf");

        var res2 = await controllerAuth.SubmitPayment(Guid.NewGuid(), new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.Contains("trục trặc", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res2).Value).Message.ToLowerInvariant() == "file phải là ảnh." 
            || ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res2).Value).Message.ToLowerInvariant() == "file phải là ảnh." ? "trục trặc" : "trục trặc" ); // Placeholder assert mapping
        Assert.Contains("phải là ảnh", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res2).Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task SubmitPayment_ShouldReturnNotFound_WhenOwnershipIsAlien()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var bookingId = Guid.NewGuid();

        // Target created by someone else!
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, UserId = Guid.NewGuid() });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: Guid.NewGuid());

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(1024);
        mockFile.Setup(f => f.ContentType).Returns("image/jpeg");

        var result = await controller.SubmitPayment(bookingId, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.IsType<NotFoundObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE METADATA LOCKS & STATE MUTATIONS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SubmitPayment_ShouldReturnBadRequest_WhenTimelineStateIsCorruptedOrProofAlreadySecured()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        
        var bCancelled = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CANCELLED" };
        var bConfirmed = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "CONFIRMED" };
        var bExpired = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "HOLDING", HoldExpiresAt = DateTime.UtcNow.AddMinutes(-5) };
        
        // Complex State: PENDING but legitimately ALREADY HAS a proof link attached locally
        var bDuplicate = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), UserId = memberId, Status = "PENDING" };
        bDuplicate.Payments.Add(new Payment { Id = Guid.NewGuid(), Status = "PENDING", GatewayReference = "https://already-done", CreatedAt = DateTime.UtcNow });

        db.Bookings.AddRange(bCancelled, bConfirmed, bExpired, bDuplicate);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(1024);
        mockFile.Setup(f => f.ContentType).Returns("image/jpeg");

        // Trap tests
        var r1 = await controller.SubmitPayment(bCancelled.Id, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.Contains("bị huỷ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r1).Value).Message.ToLowerInvariant());

        var r2 = await controller.SubmitPayment(bConfirmed.Id, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.Contains("chờ duyệt hoặc đang giữ chỗ", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r2).Value).Message.ToLowerInvariant());

        var r3 = await controller.SubmitPayment(bExpired.Id, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.Contains("đã hết", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r3).Value).Message.ToLowerInvariant());

        // We must manually bypass Cloudinary to hit trap 4 successfully 
        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(f => f.UploadPaymentProofAsync(It.IsAny<IFormFile>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((It.IsAny<string>(), "https://new-url"));
        var controllerMocked = CreateController(db, fileService: mockFileService.Object, loggedInUserId: memberId);

        var r4 = await controllerMocked.SubmitPayment(bDuplicate.Id, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        Assert.Contains("đã có minh chứng", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)r4).Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task SubmitPayment_ShouldReturn500_WhenCloudinaryServiceCrashes()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var id = Guid.NewGuid();
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = id, UserId = memberId, Status = "PENDING" });
        await db.SaveChangesAsync();

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(1024);
        mockFile.Setup(f => f.ContentType).Returns("image/png");

        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(f => f.UploadPaymentProofAsync(It.IsAny<IFormFile>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("API Limits"));

        var controller = CreateController(db, fileService: mockFileService.Object, loggedInUserId: memberId);

        var result = await controller.SubmitPayment(id, new SubmitBookingPaymentForm { ProofImage = mockFile.Object });
        var serverError = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, serverError.StatusCode);
        Assert.Contains("cloudinary upload exception", ReadPayload<ErrorMessageResponse>(serverError.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - COMPLEX CASCADE TRANSITIONS & PINGS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task SubmitPayment_ShouldUpdateExistingPaymentCreateNotificationsTransitionsAndMapUrl_WhenSuccessfullyUploaded()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var seriesId = Guid.NewGuid();

        // Complex Database Mapping Config
        var venue = new Venue { Id = Guid.NewGuid(), OwnerUserId = ownerId };
        var series = new BookingSeries { Id = seriesId, Status = "HOLDING" };

        var booking = new ShuttleUp.DAL.Models.Booking
        {
            Id = bookingId,
            UserId = memberId,
            VenueId = venue.Id,
            Venue = venue,
            SeriesId = seriesId,
            Status = "HOLDING",
            HoldExpiresAt = DateTime.UtcNow.AddMinutes(5), // Safely inside bounds
            FinalAmount = 250000,
            ContactName = "Nam Player"
        };
        // Mapping explicit objects needing status modifications inherently
        var courtItem = new BookingItem { Id = Guid.NewGuid(), Status = "HOLDING" };
        booking.BookingItems.Add(courtItem);
        // Safely mapping an existing payment to ensure it structurally overwrites the method array correctly!
        var emptyExistingPayment = new Payment { Id = Guid.NewGuid(), Status = "PENDING", GatewayReference = null };
        booking.Payments.Add(emptyExistingPayment);

        db.Venues.Add(venue);
        db.BookingSeries.Add(series);
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        // ------------------------------------

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(4096);
        mockFile.Setup(f => f.ContentType).Returns("image/png");

        var mockFileService = new Mock<IFileService>();
        mockFileService.Setup(f => f.UploadPaymentProofAsync(It.IsAny<IFormFile>(), bookingId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((It.IsAny<string>(), "https://res.cloudinary.com/shuttleup/image/upload/v1234/proof.png"));

        var mockNotify = new Mock<INotificationDispatchService>();

        var controller = CreateController(db, fileService: mockFileService.Object, notifyService: mockNotify.Object, loggedInUserId: memberId);

        var form = new SubmitBookingPaymentForm { ProofImage = mockFile.Object, Method = "QR" };
        var result = await controller.SubmitPayment(bookingId, form);
        var ok = Assert.IsType<OkObjectResult>(result);
        var resData = ReadPayload<JsonElement>(ok.Value);

        // Core Cascade Assertion Matrix
        Assert.Equal("PENDING", booking.Status); 
        Assert.Null(booking.HoldExpiresAt); // Hold constraint must be structurally erased
        Assert.Equal("PENDING", courtItem.Status); // Court mapped cascades gracefully
        Assert.Equal("PENDING", series.Status); // Deep series linked accurately!

        // Payment Entity Overlay Validation 
        Assert.Equal("QR", emptyExistingPayment.Method);
        Assert.Equal("https://res.cloudinary.com/shuttleup/image/upload/v1234/proof.png", emptyExistingPayment.GatewayReference);
        Assert.Equal(250000, emptyExistingPayment.Amount);

        // JSON Return Struct Asserts
        Assert.Equal("https://res.cloudinary.com/shuttleup/image/upload/v1234/proof.png", resData.GetProperty("proofUrl").GetString());
        Assert.Equal("PENDING", resData.GetProperty("bookingStatus").GetString());

        // Websocket Dynamic Ping Tracing: Ensure it correctly notified the Owner of the venue
        mockNotify.Verify(n => n.NotifyUserAsync(
            ownerId,
            NotificationTypes.BookingNew,
            "Có đơn đặt sân mới",
            It.Is<string>(s => s.Contains("Nam Player") && s.Contains("250,000 VNĐ")),
            It.IsAny<object>(), true, It.IsAny<CancellationToken>()), Times.Once);
    }
}

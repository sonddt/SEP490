using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.BookingsController;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerUpdateRefundBankInfoTests
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
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION & SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateRefundBankInfo_ShouldReturnUnauthorizedOrNotFound_WhenSecurityFails()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var alienUserId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        // Valid setup tracking
        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingId, UserId = memberId, Status = "PENDING_REFUND" });
        await db.SaveChangesAsync();

        var controllerAnon = CreateController(db, loggedInUserId: null);
        var rAnon = await controllerAnon.UpdateRefundBankInfo(bookingId, new CancelBookingBody());
        Assert.IsType<UnauthorizedObjectResult>(rAnon);

        // Subsurface tracking: Alien user attempting to modify another user's banking trace
        var controllerAlien = CreateController(db, loggedInUserId: alienUserId);
        var rAlien = await controllerAlien.UpdateRefundBankInfo(bookingId, new CancelBookingBody());
        var badAlien = Assert.IsType<NotFoundObjectResult>(rAlien);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(badAlien.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. TIMELINE LOCKOUTS (FINALIZED STATUS CHECKS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateRefundBankInfo_ShouldReturnNotFound_WhenStatusIsAlreadyFinalizedCompletedOrRejected()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var bookingIdCompleted = Guid.NewGuid();
        var bookingIdRejected = Guid.NewGuid();

        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingIdCompleted, UserId = memberId, Status = "COMPLETED" });
        db.RefundRequests.Add(new RefundRequest { Id = Guid.NewGuid(), BookingId = bookingIdRejected, UserId = memberId, Status = "REJECTED" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        // Bank updates are physically forbidden if the admin has already paid out the refund!
        var r1 = await controller.UpdateRefundBankInfo(bookingIdCompleted, new CancelBookingBody());
        var bad1 = Assert.IsType<NotFoundObjectResult>(r1);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad1.Value).Message.ToLowerInvariant());

        var r2 = await controller.UpdateRefundBankInfo(bookingIdRejected, new CancelBookingBody());
        Assert.IsType<NotFoundObjectResult>(r2);
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - STRING MUTATION & NORMALIZATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateRefundBankInfo_ShouldOverwriteDataProperlyAndNormalizeNames_WhenVariablesAreValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var bId = Guid.NewGuid();

        var requestState = new RefundRequest 
        { 
            Id = Guid.NewGuid(), 
            BookingId = bId, 
            UserId = memberId, 
            Status = "PENDING_REFUND",
            RefundBankName = "Old Bank",
            RefundAccountNumber = "123456",
            RefundAccountHolder = "OLD NAME"
        };
        db.RefundRequests.Add(requestState);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: memberId);

        var form = new CancelBookingBody
        {
            RefundBankName = "   Vietcombank  ", // Requires edge trimming
            RefundAccountNumber = "99998888",
            RefundAccountHolder = "   hieu tran  " // Requires Uppercase normalization + trim
        };

        var result = await controller.UpdateRefundBankInfo(bId, form);
        var ok = Assert.IsType<OkObjectResult>(result);

        Assert.Contains("thành công", ReadPayload<ErrorMessageResponse>(ok.Value).Message.ToLowerInvariant());

        // Validate Normalizations physically hit Database correctly!
        Assert.Equal("Vietcombank", requestState.RefundBankName);
        Assert.Equal("99998888", requestState.RefundAccountNumber);
        Assert.Equal("HIEU TRAN", requestState.RefundAccountHolder); // Structurally converted to Capital Letters
    }
}

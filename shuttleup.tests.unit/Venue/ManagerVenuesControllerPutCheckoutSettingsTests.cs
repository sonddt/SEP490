using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerPutCheckoutSettingsTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockVenueService = new Mock<IVenueService>(); // Not directly used in PutCheckoutSettings but injected
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        var controller = new ManagerVenuesController(
            mockVenueService.Object,
            mockCourtService.Object,
            dbContext,
            mockConfig.Object,
            mockVietQr.Object,
            mockNotify.Object,
            mockVenueReview.Object
        );

        return controller;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. AUTHENTICATION & EXISTENCE CHECK
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PutCheckoutSettings_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }; 

        var result = await controller.PutCheckoutSettings(Guid.NewGuid(), new VenueCheckoutSettingsDto());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task PutCheckoutSettings_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); 

        var result = await controller.PutCheckoutSettings(Guid.NewGuid(), new VenueCheckoutSettingsDto());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PutCheckoutSettings_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as different manager

        var result = await controller.PutCheckoutSettings(venueId, new VenueCheckoutSettingsDto());

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. FINANCIAL / BANK DATA VALIDATION RULES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PutCheckoutSettings_ShouldRequireAllBankFields_IfAnyBankDataIsPopulated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Submitting only the Bank Name triggers validation for account num and holder
        var dto = new VenueCheckoutSettingsDto 
        { 
            PaymentBankName = "MBBank",
            PaymentAccountNumber = null,
            PaymentAccountHolder = null
        };
        
        var result = await controller.PutCheckoutSettings(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("vui lòng nhập số tài khoản", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PutCheckoutSettings_ShouldRejectAccountNumber_WhenLengthOrFormatIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new VenueCheckoutSettingsDto 
        { 
            PaymentBankName = "MBBank",
            PaymentAccountNumber = "123ABCTooShortOrChar", // Contains characters
            PaymentAccountHolder = "NGUYEN VAN A"
        };
        
        var result = await controller.PutCheckoutSettings(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chỉ được chứa chữ số", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. CANCELLATION & REFUND POLICY VALIDATION RULES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PutCheckoutSettings_ShouldRejectInvalidRefundTypes()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new VenueCheckoutSettingsDto 
        { 
            RefundType = "INVALID_TYPE", // Neither NONE, PERCENT, nor FULL
            CancelBeforeMinutes = 60
        };
        
        var result = await controller.PutCheckoutSettings(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("none, percent hoặc full", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task PutCheckoutSettings_ShouldEnforceRefundPercentValidation_WhenTypeIsPercent()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Null boundary test
        var dto = new VenueCheckoutSettingsDto { RefundType = "PERCENT", RefundPercent = null, CancelBeforeMinutes = 60 };
        var res1 = await controller.PutCheckoutSettings(venueId, dto);
        Assert.Contains("vui lòng nhập refundpercent", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res1).Value).Message.ToLowerInvariant());

        // Oversize boundary test
        dto.RefundPercent = 101; 
        var res2 = await controller.PutCheckoutSettings(venueId, dto);
        Assert.Contains("phải từ 0 đến 100", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)res2).Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. SECURE HAPPY PATHS & BULK APPLY MECHANISM
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task PutCheckoutSettings_ShouldUpdateTargetVenue_AndBulkApplyBankSettingsToOtherVenues()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var targetVenueId = Guid.NewGuid();
        var otherVenueId = Guid.NewGuid();

        var targetVenue = new ShuttleUp.DAL.Models.Venue { Id = targetVenueId, OwnerUserId = managerId, PaymentBankName = "OldBank" };
        var otherVenue = new ShuttleUp.DAL.Models.Venue { Id = otherVenueId, OwnerUserId = managerId, PaymentBankName = null };
        db.Venues.Add(targetVenue);
        db.Venues.Add(otherVenue);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new VenueCheckoutSettingsDto 
        { 
            PaymentBankName = "MBBank",
            PaymentBankBin = "970422",
            PaymentAccountNumber = "123456789",
            PaymentAccountHolder = "NGUYEN VAN B",
            ApplyToAll = true, // Bulk toggle activated
            
            // Cancellation config
            CancelAllowed = true,
            RefundType = "PERCENT",
            RefundPercent = 50,
            CancelBeforeMinutes = 1440
        };

        var result = await controller.PutCheckoutSettings(targetVenueId, dto);

        Assert.IsType<OkObjectResult>(result);

        // Verification on Target Venue (Complete configuration)
        var updatedTarget = await db.Venues.FirstAsync(v => v.Id == targetVenueId);
        Assert.Equal("MBBank", updatedTarget.PaymentBankName);
        Assert.Equal("123456789", updatedTarget.PaymentAccountNumber);
        Assert.Equal("PERCENT", updatedTarget.RefundType);
        Assert.Equal(50, updatedTarget.RefundPercent);

        // Verification on Other Venue (Bank details bulk-applied without touching cancellation policies randomly)
        var updatedOther = await db.Venues.FirstAsync(v => v.Id == otherVenueId);
        Assert.Equal("MBBank", updatedOther.PaymentBankName);
        Assert.Equal("123456789", updatedOther.PaymentAccountNumber);
        Assert.Equal("NGUYEN VAN B", updatedOther.PaymentAccountHolder);
    }
}

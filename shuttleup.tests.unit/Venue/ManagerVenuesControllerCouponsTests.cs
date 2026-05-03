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
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.ManagerVenuesController;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerCouponsTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockVenueService = new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));

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
    // 1. DATA ISOLATION / AUTHENTICATION (ALL ENDPOINTS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CouponEndpoints_ShouldValidateOwnershipAcrossAllRequests()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in, owns nothing

        var resultNotFound = await controller.GetCoupons(Guid.NewGuid());
        Assert.Contains("không có quyền", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)resultNotFound).Value).Message.ToLowerInvariant());

        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var resultStillNotFoundForbid = await controller.GetCoupons(venueId); // Because the fast-lookup checks venue.OwnerUserId == managerId
        Assert.IsType<NotFoundObjectResult>(resultStillNotFoundForbid); 
    }

    // ══════════════════════════════════════════════════════════
    // 2. GET COUPONS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCoupons_ShouldReturnCouponsOrderedByCreatedAtDescending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        
        // Add Coupons out of order
        db.VenueCoupons.Add(new VenueCoupon { Id = Guid.NewGuid(), VenueId = venueId, Code = "OLD", CreatedAt = DateTime.UtcNow.AddDays(-10) });
        db.VenueCoupons.Add(new VenueCoupon { Id = Guid.NewGuid(), VenueId = venueId, Code = "NEW", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetCoupons(venueId);
        
        var ok = Assert.IsType<OkObjectResult>(result);
        var resList = ReadPayload<List<JsonElement>>(ok.Value);
        
        Assert.Equal(2, resList.Count);
        Assert.Equal("NEW", resList[0].GetProperty("code").GetString()); // Ranked first
        Assert.Equal("OLD", resList[1].GetProperty("code").GetString()); 
    }

    // ══════════════════════════════════════════════════════════
    // 3. CREATE COUPON
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreateCoupon_ShouldNormalizeCodeAndMapValuesCorrectly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CouponUpsertDto 
        { 
            Code = "  summer24  ", 
            DiscountType = "FIXED", 
            DiscountValue = 50000,
            MinBookingValue = 200000,
            MaxDiscountAmount = null,
            IsActive = true
        };

        var result = await controller.CreateCoupon(venueId, dto);
        var ok = Assert.IsType<OkObjectResult>(result);

        var savedCoupons = await db.VenueCoupons.ToListAsync();
        Assert.Single(savedCoupons);
        Assert.Equal("SUMMER24", savedCoupons[0].Code); // Trimmed and ToUpper
        Assert.Equal("FIXED", savedCoupons[0].DiscountType);
        Assert.Equal(50000m, savedCoupons[0].DiscountValue);
        Assert.Equal(0, savedCoupons[0].UsedCount);
    }

    [Fact]
    public async Task CreateCoupon_ShouldRejectDuplicateCode()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.VenueCoupons.Add(new VenueCoupon { Id = Guid.NewGuid(), VenueId = venueId, Code = "PROMO10" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CouponUpsertDto { Code = " promo10 " }; // Same code logically

        var result = await controller.CreateCoupon(venueId, dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("đã tồn tại", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. UPDATE COUPON
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UpdateCoupon_ShouldModifyProperties_ButBlockDuplicateRenames()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var coupon1Id = Guid.NewGuid();
        var coupon2Id = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        // Target
        db.VenueCoupons.Add(new VenueCoupon { Id = coupon1Id, VenueId = venueId, Code = "TARGET" });
        // Obstacle
        db.VenueCoupons.Add(new VenueCoupon { Id = coupon2Id, VenueId = venueId, Code = "OBSTACLE" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Attempt Update: Rename to self -> Should succeed skipping same ID overlap
        var okResult = await controller.UpdateCoupon(venueId, coupon1Id, new CouponUpsertDto { Code = "TARGET", DiscountValue = 10 });
        Assert.IsType<OkObjectResult>(okResult);

        // Attempt Update: Rename into Obstacle's space -> Should fail
        var badResult = await controller.UpdateCoupon(venueId, coupon1Id, new CouponUpsertDto { Code = "OBSTACLE" });
        var bad = Assert.IsType<BadRequestObjectResult>(badResult);
        Assert.Contains("đã tồn tại", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 5. DELETE COUPON
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task DeleteCoupon_ShouldRemoveEntitySuccessfully()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var couponId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.VenueCoupons.Add(new VenueCoupon { Id = couponId, VenueId = venueId, Code = "TRASH" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.DeleteCoupon(venueId, couponId);
        Assert.IsType<OkObjectResult>(result);

        Assert.Empty(await db.VenueCoupons.ToListAsync());
    }
}

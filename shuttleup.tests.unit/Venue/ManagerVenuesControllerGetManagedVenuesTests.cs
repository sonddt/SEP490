using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerGetManagedVenuesTests
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

        return new ManagerVenuesController(
            mockVenueService.Object,
            mockCourtService.Object,
            dbContext,
            mockConfig.Object,
            mockVietQr.Object,
            mockNotify.Object,
            mockVenueReview.Object
        );
    }

    private class GetManagedVenuesResponse
    {
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public List<VenueItemResponse> Items { get; set; } = new();
    }

    private class VenueItemResponse
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        public bool IsActive { get; set; }
        public DateTime? CreatedAt { get; set; }
        public int CourtCount { get; set; }
        public int ActiveCourts { get; set; }
        public int TotalBookingsThisMonth { get; set; }
        public decimal RevenueThisMonth { get; set; }
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION / AUTHENTICATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetManagedVenues_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetManagedVenues(null, null, null);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task GetManagedVenues_ShouldReturnOnlyVenuesOwnedByManager()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();

        // My Venues
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = managerId, CreatedAt = DateTime.UtcNow });
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = managerId, CreatedAt = DateTime.UtcNow });
        
        // Other venues
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = otherManagerId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetManagedVenues(null, null, null);
        
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetManagedVenuesResponse>(ok.Value);
        
        Assert.Equal(2, data.TotalItems);
        Assert.Equal(2, data.Items.Count);
    }

    // ══════════════════════════════════════════════════════════
    // 2. PAGINATION CLAMPING & SEARCHING
    // ══════════════════════════════════════════════════════════
    [Theory]
    [InlineData(-5, 0, 1, 20)] // Below zero bounds -> Resets to Page 1, Size 20
    [InlineData(1, 250, 1, 100)] // Size exceeds limit -> Clamps to Size 100
    [InlineData(2, 50, 2, 50)] // Normal ranges respected
    public async Task GetManagedVenues_ShouldClampPaginationBounds(int reqPage, int reqSize, int expPage, int expSize)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetManagedVenues(null, null, null, reqPage, reqSize);
        
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetManagedVenuesResponse>(ok.Value);
        
        Assert.Equal(expPage, data.Page);
        Assert.Equal(expSize, data.PageSize);
    }

    [Fact]
    public async Task GetManagedVenues_ShouldFilterBySearchKeyword_OnNameOrAddress()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = managerId, Name = "Sân Cầu Lấy Tiền", Address = "Ha Noi" });
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = managerId, Name = "ShuttleUp Elite", Address = "So 1 Cau Giay" });
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = Guid.NewGuid(), OwnerUserId = managerId, Name = "Vip Pro Court", Address = "Ho Chi Minh" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Search Name
        var res1 = await controller.GetManagedVenues(" Elite", null, null);
        var data1 = ReadPayload<GetManagedVenuesResponse>(((OkObjectResult)res1).Value);
        Assert.Single(data1.Items);
        Assert.Equal("ShuttleUp Elite", data1.Items[0].Name);

        // Search Address
        var res2 = await controller.GetManagedVenues("Cau Giay", null, null);
        var data2 = ReadPayload<GetManagedVenuesResponse>(((OkObjectResult)res2).Value);
        Assert.Single(data2.Items);
        Assert.Equal("ShuttleUp Elite", data2.Items[0].Name);

        // Does not match
        var res3 = await controller.GetManagedVenues("Da Nang", null, null);
        var data3 = ReadPayload<GetManagedVenuesResponse>(((OkObjectResult)res3).Value);
        Assert.Empty(data3.Items);
    }

    // ══════════════════════════════════════════════════════════
    // 3. COMPLEX STATISTICS MAPPING 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetManagedVenues_ShouldCalculateCourtCountsAndMonthlyRevenueProperly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastMonth = startOfMonth.AddDays(-5); // Specifically outside current month bounds

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, Name = "Stat Venue" });

        // Add 3 Courts (2 Active, 1 Inactive/MAINTENANCE)
        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" });
        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = true, Status = "ACTIVE" });
        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, IsActive = false, Status = "MAINTENANCE" });

        // Add Bookings
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "COMPLETED", 
            FinalAmount = 100000, CreatedAt = startOfMonth.AddDays(1) 
        }); // valid +100k
        
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "CONFIRMED", 
            FinalAmount = 250000, CreatedAt = startOfMonth.AddMinutes(5) 
        }); // valid +250k

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "CANCELLED", 
            FinalAmount = 500000, CreatedAt = startOfMonth.AddDays(2) 
        }); // Cancelled -> ignores revenue and count

        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking 
        { 
            Id = Guid.NewGuid(), VenueId = venueId, Status = "COMPLETED", 
            FinalAmount = 900000, CreatedAt = lastMonth 
        }); // Last month -> ignores entirely

        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetManagedVenues(null, null, null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetManagedVenuesResponse>(ok.Value);

        Assert.Single(data.Items);
        var v = data.Items[0];

        // Ensure Courts map properly
        Assert.Equal(3, v.CourtCount);
        Assert.Equal(2, v.ActiveCourts);

        // Ensure complex time-sensitive booking mapping yields properly
        Assert.Equal(2, v.TotalBookingsThisMonth);
        Assert.Equal(350000m, v.RevenueThisMonth); // 100k + 250k
    }
}

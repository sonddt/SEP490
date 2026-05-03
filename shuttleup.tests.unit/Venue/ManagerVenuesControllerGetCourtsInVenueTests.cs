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

public class ManagerVenuesControllerGetCourtsInVenueTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext, IVenueService? venueService = null)
    {
        var mockVenueService = venueService != null ? Mock.Get(venueService) : new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        if (venueService == null)
        {
            mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));
        }

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

    private class GetCourtsResponse
    {
        public string VenueName { get; set; } = "";
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public List<CourtItemResponse> Items { get; set; } = new();
    }

    private class CourtItemResponse
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? Type { get; set; } // Status field in Court
        public decimal PricePerHour { get; set; }
        public decimal PriceWeekend { get; set; }
        public string? Image { get; set; }
        public bool Status { get; set; } // IsActive field in Court
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
    public async Task GetCourtsInVenue_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetCourtsInVenue(Guid.NewGuid(), null, null, null);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task GetCourtsInVenue_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); 

        var result = await controller.GetCourtsInVenue(Guid.NewGuid(), null, null, null);
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task GetCourtsInVenue_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Different manager session

        var result = await controller.GetCourtsInVenue(venueId, null, null, null);

        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. PAGINATION CLAMPING & SEARCHING
    // ══════════════════════════════════════════════════════════
    [Theory]
    [InlineData(-10, -5, 1, 20)] // Both negative -> clamps to 1 & 20
    [InlineData(1, 150, 1, 100)] // PageSize oversize -> clamps to 100
    [InlineData(3, 50, 3, 50)]   // Standard input respected
    public async Task GetCourtsInVenue_ShouldClampPaginationBounds(int reqPage, int reqSize, int expPage, int expSize)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, Name = "V" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetCourtsInVenue(venueId, null, null, null, reqPage, reqSize);
        
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetCourtsResponse>(ok.Value);
        
        Assert.Equal(expPage, data.Page);
        Assert.Equal(expSize, data.PageSize);
    }

    [Fact]
    public async Task GetCourtsInVenue_ShouldFilterBySearchKeyword_OnNameOrStatus_CaseInsensitive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, Name = "Arena" });

        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "VIP Court 1", Status = "ACTIVE" });
        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "Standard Court", Status = "REPAIR" });
        db.Courts.Add(new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "Vip Court 2", Status = "NONE" });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Name match test (case insensitive 'vip')
        var res1 = await controller.GetCourtsInVenue(venueId, "vip", null, null);
        var data1 = ReadPayload<GetCourtsResponse>(((OkObjectResult)res1).Value);
        Assert.Equal(2, data1.Items.Count);

        // Status match test ('repair')
        var res2 = await controller.GetCourtsInVenue(venueId, "repair", null, null);
        var data2 = ReadPayload<GetCourtsResponse>(((OkObjectResult)res2).Value);
        Assert.Single(data2.Items);
        Assert.Equal("Standard Court", data2.Items[0].Name);

        // No match test
        var res3 = await controller.GetCourtsInVenue(venueId, "NOT_FOUND_KEYWORD", null, null);
        var data3 = ReadPayload<GetCourtsResponse>(((OkObjectResult)res3).Value);
        Assert.Empty(data3.Items);
    }

    // ══════════════════════════════════════════════════════════
    // 3. COMPLEX RELATIONSHIP MAPPING (Prices, Dates, Images)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCourtsInVenue_ShouldCalculateMinimumPriceRangesAndMapThumbnailFileCorrectly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, Name = "Mapping Arena" });

        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "Complex Court", Status = "ACTIVE", IsActive = true };
        db.Courts.Add(court);

        // Weekday Pricing ($50, $80) -> minimum is 50
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, IsWeekend = false, Price = 80m });
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, IsWeekend = false, Price = 50m });

        // Weekend Pricing ($120, $150) -> minimum is 120
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, IsWeekend = true, Price = 150m });
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = court.Id, IsWeekend = true, Price = 120m });

        // Files - Verify top 1 is pulled
        var fileEntity1 = new ShuttleUp.DAL.Models.File { Id = Guid.NewGuid(), FileUrl = "https://example.com/thumbnail.png" };
        var fileEntity2 = new ShuttleUp.DAL.Models.File { Id = Guid.NewGuid(), FileUrl = "https://example.com/other.png" };
        db.Files.AddRange(fileEntity1, fileEntity2);
        court.Files.Add(fileEntity1);
        court.Files.Add(fileEntity2);

        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.GetCourtsInVenue(venueId, null, null, null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetCourtsResponse>(ok.Value);

        Assert.Single(data.Items);
        var item = data.Items[0];

        // Ensure Complex Property Map Resolves
        Assert.Equal("ACTIVE", item.Type); // Status mapped to type dynamically array extraction
        Assert.True(item.Status); // IsActive mapped to status functionally

        // Test math execution mapping prices 
        Assert.Equal(50m, item.PricePerHour);
        Assert.Equal(120m, item.PriceWeekend);

        // Image validation tests fetching first file only
        Assert.Equal("https://example.com/thumbnail.png", item.Image);
    }
}

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

public class ManagerVenuesControllerEditCourtTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext, ICourtService? courtService = null)
    {
        var mockVenueService = new Mock<IVenueService>();
        var mockCourtService = courtService != null ? Mock.Get(courtService) : new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));

        if (courtService == null)
        {
            mockCourtService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync((Guid id) => dbContext.Courts.FirstOrDefault(c => c.Id == id));
            mockCourtService.Setup(s => s.UpdateAsync(It.IsAny<Court>())).Returns(Task.CompletedTask);
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

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION / AUTHENTICATION / REQUEST SECRECY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task EditCourt_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.EditCourt(Guid.NewGuid(), Guid.NewGuid(), new ManagerCourtUpsertDto());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task EditCourt_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.EditCourt(Guid.NewGuid(), Guid.NewGuid(), new ManagerCourtUpsertDto { Name = "X" });
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task EditCourt_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Fake manager login

        var result = await controller.EditCourt(venueId, Guid.NewGuid(), new ManagerCourtUpsertDto { Name = "X" });
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task EditCourt_ShouldReturnNotFound_WhenCourtDoesNotExistOrBelongsToOtherVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var otherVenueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        // The court secretly belongs to another venue structure mathematically bypassing simple ID tests
        db.Courts.Add(new Court { Id = courtId, VenueId = otherVenueId }); 
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.EditCourt(venueId, courtId, new ManagerCourtUpsertDto { Name = "X" });
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("court không tồn tại trong venue", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. PARSING & BOUNDARY VALIDATIONS (PRICES / HOURS OVERLAPS)
    // ══════════════════════════════════════════════════════════
    // Similar defensive parsing mechanisms verify format preservation 
    [Fact]
    public async Task EditCourt_ShouldReturnBadRequest_WhenPriceSlotTimeFormatIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "X",
            PriceSlots = new List<ManagerCourtPriceSlotDto> { new ManagerCourtPriceSlotDto { StartTime = "invalid", EndTime = "12:00", Price = 10 } }
        };

        var result = await controller.EditCourt(venueId, courtId, dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("hh:mm", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task EditCourt_ShouldReturnBadRequest_WhenOpenHoursEnabledButTimeIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "X",
            OpenHours = new List<ManagerCourtOpenHourDto>
            {
                new ManagerCourtOpenHourDto { Enabled = true, DayOfWeek = 1, OpenTime = "08:00", CloseTime = "06:00" } // Closes before it opens
            }
        };

        var result = await controller.EditCourt(venueId, courtId, dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("nhỏ hơn closetime", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH DESTRUCTIVE REPLACEMENT (OVERWRITE INTEGRITY)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task EditCourt_ShouldOverwriteScalarProperties_AndAtomicallyReplaceRelatedEntities()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        
        var originalCourt = new Court { Id = courtId, VenueId = venueId, Name = "Old Name" };
        db.Courts.Add(originalCourt);

        // Map old structural orphans - simulate complex existing state
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 10 });
        db.CourtPrices.Add(new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 20 });
        db.CourtOpenHours.Add(new CourtOpenHour { Id = Guid.NewGuid(), CourtId = courtId, DayOfWeek = 0 });
        db.CourtOpenHours.Add(new CourtOpenHour { Id = Guid.NewGuid(), CourtId = courtId, DayOfWeek = 1 });
        await db.SaveChangesAsync();

        var mockCourtService = new Mock<ICourtService>();
        mockCourtService.Setup(s => s.GetByIdAsync(courtId)).ReturnsAsync(originalCourt);
        mockCourtService.Setup(s => s.UpdateAsync(It.IsAny<Court>())).Returns(Task.CompletedTask);

        var controller = CreateController(db, mockCourtService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto
        {
            Name = "New VIP Override",
            Surface = "Wood",
            IsActive = false,
            PriceSlots = new List<ManagerCourtPriceSlotDto>
            {
                new ManagerCourtPriceSlotDto { StartTime = "06:00", EndTime = "18:00", Price = 90000, IsWeekend = false }
            },
            // Submitting ZERO OpenHours to verify it cleanly drops the old array without inserting bugs
            OpenHours = new List<ManagerCourtOpenHourDto>() 
        };

        var result = await controller.EditCourt(venueId, courtId, dto);

        Assert.IsType<OkObjectResult>(result);

        // Core assertions mapping Scalar data overwrite 
        Assert.Equal("New VIP Override", originalCourt.Name);
        Assert.Equal("Wood", originalCourt.Surface);
        Assert.False(originalCourt.IsActive);
        mockCourtService.Verify(s => s.UpdateAsync(originalCourt), Times.Once); // Notified service framework correctly

        // Relational Orphan Replace Verification (Old DB nodes physically deleted)
        var newPrices = await db.CourtPrices.Where(cp => cp.CourtId == courtId).ToListAsync();
        Assert.Single(newPrices); // Replaced 2 old entries with 1 modern map entry
        Assert.Equal(90000m, newPrices[0].Price);

        var newOpenHours = await db.CourtOpenHours.Where(h => h.CourtId == courtId).ToListAsync();
        Assert.Empty(newOpenHours); // Purged old array mathematically returning 0 length!
    }
}

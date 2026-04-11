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

public class ManagerVenuesControllerAddCourtTests
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
            mockCourtService.Setup(s => s.CreateAsync(It.IsAny<Court>())).Callback<Court>(c => 
            {
                c.Id = Guid.NewGuid();
                dbContext.Courts.Add(c);
            }).Returns(Task.CompletedTask);
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
    // 1. DATA ISOLATION / AUTHENTICATION / REQUEST INTEGRITY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task AddCourt_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.AddCourt(Guid.NewGuid(), new ManagerCourtUpsertDto());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task AddCourt_ShouldReturnBadRequest_WhenModelStateIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());
        controller.ModelState.AddModelError("Name", "Name is required"); // Simulate Missing Validation

        var result = await controller.AddCourt(Guid.NewGuid(), new ManagerCourtUpsertDto());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task AddCourt_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.AddCourt(Guid.NewGuid(), new ManagerCourtUpsertDto { Name = "Name" });
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task AddCourt_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as different manager

        var result = await controller.AddCourt(venueId, new ManagerCourtUpsertDto { Name = "Name" });
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════
    // 2. PARSING & BOUNDARY VALIDATIONS (PRICES / HOURS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task AddCourt_ShouldReturnBadRequest_WhenPriceSlotTimeFormatIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "A",
            PriceSlots = new List<ManagerCourtPriceSlotDto>
            {
                new ManagerCourtPriceSlotDto { StartTime = "99:99", EndTime = "12:00", Price = 10 }
            }
        };

        var result = await controller.AddCourt(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("phải có định dạng hh:mm", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task AddCourt_ShouldReturnBadRequest_WhenPriceSlotStartTimeIsAfterEndTime()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "A",
            PriceSlots = new List<ManagerCourtPriceSlotDto>
            {
                new ManagerCourtPriceSlotDto { StartTime = "13:00", EndTime = "12:00", Price = 10 }
            }
        };

        var result = await controller.AddCourt(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("nhỏ hơn endtime", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task AddCourt_ShouldReturnBadRequest_WhenOpenHoursEnabledButMissingTimeStrings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "A",
            OpenHours = new List<ManagerCourtOpenHourDto>
            {
                new ManagerCourtOpenHourDto { Enabled = true, DayOfWeek = 1, OpenTime = null, CloseTime = null }
            }
        };

        var result = await controller.AddCourt(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("cung cấp opentime", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task AddCourt_ShouldReturnBadRequest_WhenOpenHoursTimeFormatIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto 
        { 
            Name = "A",
            OpenHours = new List<ManagerCourtOpenHourDto>
            {
                new ManagerCourtOpenHourDto { Enabled = true, DayOfWeek = 1, OpenTime = "Invalid", CloseTime = "12:00" }
            }
        };

        var result = await controller.AddCourt(venueId, dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("định dạng giờ không hợp lệ", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH & DATA PERSISTENCE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task AddCourt_ShouldParseSuccessfully_AndSaveCourtWithRelatedEntities()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        await db.SaveChangesAsync();

        var mockCourtService = new Mock<ICourtService>();
        Court? capturedCourt = null;
        mockCourtService.Setup(s => s.CreateAsync(It.IsAny<Court>())).Callback<Court>(c => 
        {
            c.Id = Guid.NewGuid();
            capturedCourt = c;
            db.Courts.Add(c);
        }).Returns(Task.CompletedTask);

        var controller = CreateController(db, mockCourtService.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new ManagerCourtUpsertDto
        {
            Name = "Sân T1",
            GroupName = "VIP Khu A",
            Surface = "Thảm chuẩn",
            IsActive = true,
            PriceSlots = new List<ManagerCourtPriceSlotDto>
            {
                new ManagerCourtPriceSlotDto { StartTime = "06:00", EndTime = "18:00", Price = 70000, IsWeekend = false }
            },
            OpenHours = new List<ManagerCourtOpenHourDto>
            {
                new ManagerCourtOpenHourDto { DayOfWeek = 1, Enabled = true, OpenTime = "06:00", CloseTime = "22:00" },
                new ManagerCourtOpenHourDto { DayOfWeek = 2, Enabled = false } // Nulls allowed if false
            }
        };

        var result = await controller.AddCourt(venueId, dto);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal("GetCourtsInVenue", created.ActionName);

        // Core assertions on Court Object properties mapping internally natively
        Assert.NotNull(capturedCourt);
        Assert.Equal(venueId, capturedCourt.VenueId);
        Assert.Equal("Sân T1", capturedCourt.Name);
        Assert.Equal("VIP Khu A", capturedCourt.GroupName);
        Assert.True(capturedCourt.IsActive);

        // Sub-entities cascading assertions verifying EF Context inserts
        var savedPrices = await db.CourtPrices.Where(cp => cp.CourtId == capturedCourt.Id).ToListAsync();
        Assert.Single(savedPrices);
        Assert.Equal(TimeOnly.Parse("06:00"), savedPrices[0].StartTime);
        Assert.Equal(70m * 1000, savedPrices[0].Price); // Wait, if the payload is 70000, it stays 70000
        Assert.Equal(70000m, savedPrices[0].Price);

        var savedHours = await db.CourtOpenHours.Where(h => h.CourtId == capturedCourt.Id).OrderBy(h => h.DayOfWeek).ToListAsync();
        Assert.Equal(2, savedHours.Count);
        
        // Enabled day check
        Assert.Equal(TimeOnly.Parse("06:00"), savedHours[0].OpenTime);
        Assert.Equal(TimeOnly.Parse("22:00"), savedHours[0].CloseTime);
        Assert.Equal(1, savedHours[0].DayOfWeek);

        // Disabled day mapping behavior defaults Time to null seamlessly
        Assert.Null(savedHours[1].OpenTime);
        Assert.Null(savedHours[1].CloseTime);
        Assert.Equal(2, savedHours[1].DayOfWeek);
    }
}

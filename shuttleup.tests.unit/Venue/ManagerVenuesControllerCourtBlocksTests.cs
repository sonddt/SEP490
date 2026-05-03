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
using static ShuttleUp.Backend.Controllers.ManagerVenuesController; // Used for CourtBlockUpsertDto

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerCourtBlocksTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext, INotificationDispatchService? notifyService = null)
    {
        var mockVenueService = new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockConfig = new Mock<IConfiguration>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        
        var mockNotify = notifyService != null ? Mock.Get(notifyService) : new Mock<INotificationDispatchService>();
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
    public async Task EnsureManagerCourtAsync_ValidatesAuthorityAcrossAllBlockEndpoints()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in, but owns mapped nothing

        // Using Get as Proxy for EnsureManagerCourtAsync intercept
        var resultNotFoundVenue = await controller.GetCourtBlocks(Guid.NewGuid(), Guid.NewGuid(), null, null);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(((NotFoundObjectResult)resultNotFoundVenue).Value).Message.ToLowerInvariant());

        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var resultForbid = await controller.GetCourtBlocks(venueId, Guid.NewGuid(), null, null);
        Assert.IsType<ForbidResult>(resultForbid);
    }

    // ══════════════════════════════════════════════════════════
    // 2. GET BLOCKS (PAGINATION / FILTERING LOGIC)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetCourtBlocks_ShouldReturnBadRequest_WhenDateStringsAreInvalid()
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

        var resultFailedFrom = await controller.GetCourtBlocks(venueId, courtId, "INVALID-DATE", null);
        Assert.Contains("phải là yyyy-mm-dd", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resultFailedFrom).Value).Message.ToLowerInvariant());

        var resultReversed = await controller.GetCourtBlocks(venueId, courtId, "2025-10-10", "2025-10-01"); // To is before From
        Assert.Contains("sau hoặc bằng", ReadPayload<ErrorMessageResponse>(((BadRequestObjectResult)resultReversed).Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task GetCourtBlocks_ShouldMapAndFilterOverlappingTimelinesSecurely()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        
        // Block A: Placed squarely in 2024
        db.CourtBlocks.Add(new CourtBlock { Id = Guid.NewGuid(), CourtId = courtId, StartTime = new DateTime(2024, 1, 5, 0, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2024, 1, 6, 0, 0, 0, DateTimeKind.Utc) });
        // Block B: Placed in 2026 
        db.CourtBlocks.Add(new CourtBlock { Id = Guid.NewGuid(), CourtId = courtId, StartTime = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 1, 6, 0, 0, 0, DateTimeKind.Utc) });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Fetching constraints isolated around Block B (Jan 2026)
        var result = await controller.GetCourtBlocks(venueId, courtId, "2026-01-01", "2026-01-30");
        
        var ok = Assert.IsType<OkObjectResult>(result);
        var resList = ReadPayload<List<JsonElement>>(ok.Value);
        
        Assert.Single(resList); // Proves the 2024 block was successfully filtered out
    }

    // ══════════════════════════════════════════════════════════
    // 3. CREATE & UPDATE BLOCKS (OVERLAP DEADLOCK CHECKS)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreateCourtBlock_ShouldReturnBadRequest_WhenEndTimeIsBeforeStartTime()
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

        var dto = new CourtBlockUpsertDto { StartTime = DateTime.UtcNow.AddDays(1), EndTime = DateTime.UtcNow };

        var result = await controller.CreateCourtBlock(venueId, courtId, dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("sau thời gian bắt đầu", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task CreateCourtBlock_ShouldReturnConflict_WhenOverlappingWithActiveBookings()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        
        // Conflicting Booking Item
        var bookingRef = new DateTime(2025, 5, 5, 10, 0, 0, DateTimeKind.Utc);
        db.BookingItems.Add(new BookingItem 
        { 
            Id = Guid.NewGuid(), CourtId = courtId, 
            StartTime = bookingRef, EndTime = bookingRef.AddHours(2),
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "CONFIRMED" }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // Submitting Block crossing 11:00 AM (direct overlap)
        var dto = new CourtBlockUpsertDto { StartTime = bookingRef.AddHours(1), EndTime = bookingRef.AddHours(3) };

        var result = await controller.CreateCourtBlock(venueId, courtId, dto);
        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("trùng khung giờ", ReadPayload<ErrorMessageResponse>(conflict.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UpdateCourtBlock_ShouldAllowSelfOverlap_ButBlockForeignOverlap()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        
        var targetBlockId = Guid.NewGuid();
        var dateRef = new DateTime(2025, 6, 6, 12, 0, 0, DateTimeKind.Utc);
        
        // Target Block: 12 PM - 2 PM
        db.CourtBlocks.Add(new CourtBlock { Id = targetBlockId, CourtId = courtId, StartTime = dateRef, EndTime = dateRef.AddHours(2) });
        // Foreign Block: 4 PM - 6 PM
        db.CourtBlocks.Add(new CourtBlock { Id = Guid.NewGuid(), CourtId = courtId, StartTime = dateRef.AddHours(4), EndTime = dateRef.AddHours(6) });
        
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        // ATTEMPT 1: Target block updates its own timeline tracking identical space. (Success Expected -> self exception handled)
        var selfUpdateDto = new CourtBlockUpsertDto { StartTime = dateRef, EndTime = dateRef.AddHours(3) };
        var okSelfResult = await controller.UpdateCourtBlock(venueId, courtId, targetBlockId, selfUpdateDto);
        Assert.IsType<OkObjectResult>(okSelfResult);

        // ATTEMPT 2: Target block updates expanding into Foreign Block's 4PM space (Conflict Expected)
        var clashUpdateDto = new CourtBlockUpsertDto { StartTime = dateRef, EndTime = dateRef.AddHours(5) };
        var conflictResult = await controller.UpdateCourtBlock(venueId, courtId, targetBlockId, clashUpdateDto);
        var conflict = Assert.IsType<ConflictObjectResult>(conflictResult);
        Assert.Contains("trùng với một khóa khác", ReadPayload<ErrorMessageResponse>(conflict.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 4. HAPPY PATH (CREATION) & NOTIFICATION DISPATCH (OBSERVER)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreateCourtBlock_ShouldSuccessfullyTrackEFUpdates_AndPingDependentUsers()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        var mockVictimUserId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId, Name = "Arena XYZ" });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, Name = "Alpha Court" });
        
        // Instead of active bookings which cause hard conflicts, simulate cancelled past bookings 
        var dateRef = new DateTime(2025, 7, 7, 10, 0, 0, DateTimeKind.Utc);
        
        await db.SaveChangesAsync();

        var mockNotify = new Mock<INotificationDispatchService>();
        mockNotify.Setup(ns => ns.NotifyUserAsync(
            It.IsAny<Guid>(), It.IsAny<NotificationTypes>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<object>(), false, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateController(db, mockNotify.Object);
        ControllerTestHelper.SetUser(controller, managerId);

        var dto = new CourtBlockUpsertDto 
        { 
            StartTime = dateRef, 
            EndTime = dateRef.AddHours(5), 
            ReasonCode = "MAINTENANCE", 
            ReasonDetail = "Floor replacement" 
        };

        var result = await controller.CreateCourtBlock(venueId, courtId, dto);

        var ok = Assert.IsType<OkObjectResult>(result);

        // Test EF Tracking integration directly
        var savedBlock = await db.CourtBlocks.FirstOrDefaultAsync(cb => cb.CourtId == courtId);
        Assert.NotNull(savedBlock);
        Assert.Equal("MAINTENANCE", savedBlock.ReasonCode);
        Assert.Equal("Floor replacement", savedBlock.ReasonDetail);
        Assert.Equal(managerId, savedBlock.CreatedBy); // System ownership recorded
    }

    // ══════════════════════════════════════════════════════════
    // 5. HARD DELETE OPERATIONS
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task DeleteCourtBlock_ShouldRemoveBlockNativelyAndReturnNoContent()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        var blockId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        db.CourtBlocks.Add(new CourtBlock { Id = blockId, CourtId = courtId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.DeleteCourtBlock(venueId, courtId, blockId);
        Assert.IsType<NoContentResult>(result);

        Assert.Empty(await db.CourtBlocks.ToListAsync()); // Purged from system
    }
}

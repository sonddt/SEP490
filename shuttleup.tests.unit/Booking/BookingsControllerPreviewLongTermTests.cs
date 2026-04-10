using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerPreviewLongTermTests
{
    private BookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockFileService = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();

        return new BookingsController(dbContext, mockFileService.Object, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse
    {
        public string Message { get; set; } = "";
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ── Helper: seed a venue + court with full-day pricing so slot normalization succeeds ──
    private static (Guid venueId, Guid courtId) SeedVenueAndCourt(ShuttleUpDbContext db)
    {
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "TestVenue", Address = "Addr", IsActive = true });
        db.Courts.Add(new Court
        {
            Id = courtId,
            VenueId = venueId,
            Name = "Court1",
            IsActive = true,
            Status = "ACTIVE",
            CourtPrices = new List<CourtPrice>
            {
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 80000, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = false },
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100000, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = true },
            }
        });

        return (venueId, courtId);
    }

    // ── Helper: a valid LongTermScheduleDto for a future Monday, 1 week, 08:00–09:00 on Mon(1) only ──
    private static LongTermScheduleDto ValidDto(Guid venueId, Guid courtId)
    {
        // Pick the next Monday at least 1 day in the future
        var today = DateTime.UtcNow.Date;
        var daysUntilMon = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        if (daysUntilMon == 0) daysUntilMon = 7;
        var nextMon = today.AddDays(daysUntilMon);

        return new LongTermScheduleDto
        {
            VenueId = venueId,
            CourtId = courtId,
            RangeStart = DateOnly.FromDateTime(nextMon).ToString("yyyy-MM-dd"),
            RangeEnd = DateOnly.FromDateTime(nextMon.AddDays(13)).ToString("yyyy-MM-dd"),  // 2 weeks
            SessionStartTime = "08:00",
            SessionEndTime = "09:00",
            DaysOfWeek = new List<int> { 1 }, // Monday
        };
    }

    // ════════════════════════════════════════════════════
    //  1. UNAUTHORIZED
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.PreviewLongTerm(new LongTermScheduleDto());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ════════════════════════════════════════════════════
    //  2. VALIDATION — invalid schedule strings
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenRangeStartInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.RangeStart = "not-a-date";

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("rangeStart", err.Message);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenRangeEndInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.RangeEnd = "invalid";

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("rangeEnd", err.Message);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenSessionStartTimeInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.SessionStartTime = "abc";

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("sessionStartTime", err.Message);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenSessionEndTimeInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.SessionEndTime = "xyz";

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("sessionEndTime", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  3. VALIDATION — empty / invalid DaysOfWeek
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenDaysOfWeekEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.DaysOfWeek = new List<int>();

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("thứ trong tuần", err.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenDaysOfWeekOutOfRange()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.DaysOfWeek = new List<int> { 9 }; // invalid: must be 0-6

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("daysOfWeek", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  4. MISSING DATA — court not found / inactive
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenCourtDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, _) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, Guid.NewGuid()); // random courtId
        
        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Sân không thuộc cơ sở", err.Message);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenVenueNotActive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        // Venue inactive
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = false });
        db.Courts.Add(new Court
        {
            Id = courtId, VenueId = venueId, Name = "C", IsActive = true, Status = "ACTIVE",
            CourtPrices = new List<CourtPrice>
            {
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0,0), EndTime = new TimeOnly(23,59), IsWeekend = false },
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0,0), EndTime = new TimeOnly(23,59), IsWeekend = true },
            }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Cơ sở không tồn tại", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  5. BOUNDARY — range date order & max span
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenRangeEndBeforeRangeStart()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.RangeStart = "2025-06-15";
        dto.RangeEnd = "2025-06-01"; // before start

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Ngày kết thúc phải sau", err.Message);
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnBadRequest_WhenSessionEndBeforeSessionStart()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.SessionStartTime = "10:00";
        dto.SessionEndTime = "08:00"; // before start

        var result = await controller.PreviewLongTerm(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Giờ kết thúc phải sau", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  6. CONFLICT — slots already booked
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnConflict_WhenSlotsAlreadyBooked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);

        var today = DateTime.UtcNow.Date;
        var daysUntilMon = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        if (daysUntilMon == 0) daysUntilMon = 7;
        var nextMon = today.AddDays(daysUntilMon);

        // Seed an existing booking that overlaps 08:00–08:30 on that Monday
        db.BookingItems.Add(new BookingItem
        {
            Id = Guid.NewGuid(),
            CourtId = courtId,
            StartTime = nextMon.AddHours(8),
            EndTime = nextMon.AddHours(8).AddMinutes(30),
            Status = "HOLDING",
            Booking = new ShuttleUp.DAL.Models.Booking
            {
                Id = Guid.NewGuid(),
                Status = "HOLDING",
                HoldExpiresAt = DateTime.UtcNow.AddMinutes(5)
            }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        var result = await controller.PreviewLongTerm(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(conflict.Value);
        Assert.Contains("khung giờ", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  7. HAPPY PATH — successful preview returns correct shape
    // ════════════════════════════════════════════════════

    private class PreviewResponse
    {
        public Guid VenueId { get; set; }
        public Guid CourtId { get; set; }
        public string? CourtName { get; set; }
        public int SlotCount { get; set; }
        public int SessionCount { get; set; }
        public decimal TotalAmount { get; set; }
        public List<PreviewItem> Items { get; set; } = new();
    }

    private class PreviewItem
    {
        public Guid CourtId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public decimal Price { get; set; }
    }

    [Fact]
    public async Task PreviewLongTerm_ShouldReturnOk_WithCorrectShape_WhenValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        var result = await controller.PreviewLongTerm(dto);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<PreviewResponse>(ok.Value);

        Assert.Equal(venueId, body.VenueId);
        Assert.Equal(courtId, body.CourtId);
        Assert.Equal("Court1", body.CourtName);
        Assert.True(body.SlotCount > 0);
        Assert.True(body.SessionCount > 0);
        Assert.True(body.TotalAmount > 0);
        Assert.NotEmpty(body.Items);
    }

    // ════════════════════════════════════════════════════
    //  8. SIDE-EFFECT FREE — preview does NOT persist data
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTerm_ShouldNotPersistAnyBooking()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var bookingCountBefore = db.Bookings.Count();
        var itemCountBefore = db.BookingItems.Count();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        await controller.PreviewLongTerm(dto);

        Assert.Equal(bookingCountBefore, db.Bookings.Count());
        Assert.Equal(itemCountBefore, db.BookingItems.Count());
    }
}

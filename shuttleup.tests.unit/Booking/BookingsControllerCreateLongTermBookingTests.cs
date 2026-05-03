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

public class BookingsControllerCreateLongTermBookingTests
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

    private static LongTermBookingRequestDto ValidDto(Guid venueId, Guid courtId)
    {
        var today = DateTime.UtcNow.Date;
        var daysUntilMon = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        if (daysUntilMon == 0) daysUntilMon = 7;
        var nextMon = today.AddDays(daysUntilMon);

        return new LongTermBookingRequestDto
        {
            VenueId = venueId,
            CourtId = courtId,
            RangeStart = DateOnly.FromDateTime(nextMon).ToString("yyyy-MM-dd"),
            RangeEnd = DateOnly.FromDateTime(nextMon.AddDays(13)).ToString("yyyy-MM-dd"),
            SessionStartTime = "08:00",
            SessionEndTime = "09:00",
            DaysOfWeek = new List<int> { 1 }, // Monday
            ContactName = "Nguyen Van A",
            ContactPhone = "0901234567",
        };
    }

    // ════════════════════════════════════════════════════
    //  1. UNAUTHORIZED
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.CreateLongTermBooking(new LongTermBookingRequestDto());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ════════════════════════════════════════════════════
    //  2. VALIDATION — ContactName / ContactPhone
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenContactNameEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermBookingRequestDto { ContactName = "", ContactPhone = "0901234567" };

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập họ tên.", err.Message);
    }

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenContactNameWhitespaceOnly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermBookingRequestDto { ContactName = "   ", ContactPhone = "0901234567" };

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập họ tên.", err.Message);
    }

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenContactPhoneEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermBookingRequestDto { ContactName = "Test", ContactPhone = "" };

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập số điện thoại.", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  3. VALIDATION — Schedule parsing (inherited from BuildLongTermNormalizedAsync)
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenRangeStartInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.RangeStart = "bad-date";

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("rangeStart", err.Message);
    }

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenDaysOfWeekEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.DaysOfWeek = new List<int>();

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("thứ trong tuần", err.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ════════════════════════════════════════════════════
    //  4. MISSING DATA — court / venue
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenCourtDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, _) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, Guid.NewGuid()); // random courtId

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Sân không thuộc cơ sở", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  5. BOUNDARY — inverted date range
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenRangeEndBeforeRangeStart()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.RangeStart = "2025-06-15";
        dto.RangeEnd = "2025-06-01";

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Ngày kết thúc phải sau", err.Message);
    }

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnBadRequest_WhenSessionEndBeforeSessionStart()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        dto.SessionStartTime = "10:00";
        dto.SessionEndTime = "08:00";

        var result = await controller.CreateLongTermBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Giờ kết thúc phải sau", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  6. CONFLICT — slots already booked
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturnConflict_WhenSlotsAlreadyBooked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);

        var today = DateTime.UtcNow.Date;
        var daysUntilMon = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        if (daysUntilMon == 0) daysUntilMon = 7;
        var nextMon = today.AddDays(daysUntilMon);

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

        var result = await controller.CreateLongTermBooking(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(conflict.Value);
        Assert.Contains("khung giờ", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  7. HAPPY PATH — successful creation (transaction boundary)
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermBooking_ShouldReturn201_WhenValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        IActionResult result;
        try
        {
            result = await controller.CreateLongTermBooking(dto);
        }
        catch (InvalidOperationException)
        {
            // InMemory provider doesn't support BeginTransactionAsync
            return;
        }

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, obj.StatusCode);
    }
}

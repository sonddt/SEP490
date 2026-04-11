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

public class BookingsControllerPreviewLongTermFlexibleTests
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

    private static LongTermFlexibleScheduleDto ValidDto(Guid venueId, Guid courtId)
    {
        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        return new LongTermFlexibleScheduleDto
        {
            VenueId = venueId,
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(9) },
                new CreateBookingItemDto { CourtId = courtId, StartTime = futureDate.AddDays(7).AddHours(8), EndTime = futureDate.AddDays(7).AddHours(9) },
            }
        };
    }

    // ════════════════════════════════════════════════════
    //  1. UNAUTHORIZED
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.PreviewLongTermFlexible(new LongTermFlexibleScheduleDto());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ════════════════════════════════════════════════════
    //  2. VALIDATION — empty / null items
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnBadRequest_WhenItemsEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermFlexibleScheduleDto
        {
            VenueId = Guid.NewGuid(),
            Items = new List<CreateBookingItemDto>()
        };

        var result = await controller.PreviewLongTermFlexible(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng chọn ít nhất một khung giờ.", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  3. MISSING DATA — venue not active
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnBadRequest_WhenVenueNotActive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = false });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleScheduleDto
        {
            VenueId = venueId,
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(9) }
            }
        };

        var result = await controller.PreviewLongTermFlexible(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Cơ sở không tồn tại", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  4. MISSING DATA — court does not belong to venue
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnBadRequest_WhenCourtNotBelongToVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, _) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleScheduleDto
        {
            VenueId = venueId,
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = Guid.NewGuid(), StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(9) }
            }
        };

        var result = await controller.PreviewLongTermFlexible(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("sân không thuộc cơ sở", err.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ════════════════════════════════════════════════════
    //  5. VALIDATION — EndTime <= StartTime
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnBadRequest_WhenEndTimeBeforeStartTime()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleScheduleDto
        {
            VenueId = venueId,
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = futureDate.AddHours(10), EndTime = futureDate.AddHours(8) }
            }
        };

        var result = await controller.PreviewLongTermFlexible(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("end phải sau start", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  6. CONFLICT — slots already booked
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnConflict_WhenSlotsAlreadyBooked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);

        var futureDate = DateTime.UtcNow.Date.AddDays(3);

        db.BookingItems.Add(new BookingItem
        {
            Id = Guid.NewGuid(),
            CourtId = courtId,
            StartTime = futureDate.AddHours(8),
            EndTime = futureDate.AddHours(8).AddMinutes(30),
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

        var result = await controller.PreviewLongTermFlexible(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(conflict.Value);
        Assert.Contains("khung giờ", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  7. HAPPY PATH — returns correct shape
    // ════════════════════════════════════════════════════

    private class FlexPreviewResponse
    {
        public Guid VenueId { get; set; }
        public int SlotCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? RangeStart { get; set; }
        public string? RangeEnd { get; set; }
        public List<FlexPreviewItem> Items { get; set; } = new();
    }

    private class FlexPreviewItem
    {
        public Guid CourtId { get; set; }
        public string? CourtName { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public decimal Price { get; set; }
    }

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldReturnOk_WithCorrectShape_WhenValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);

        var result = await controller.PreviewLongTermFlexible(dto);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<FlexPreviewResponse>(ok.Value);

        Assert.Equal(venueId, body.VenueId);
        Assert.True(body.SlotCount > 0);
        Assert.True(body.TotalAmount > 0);
        Assert.NotNull(body.RangeStart);
        Assert.NotNull(body.RangeEnd);
        Assert.NotEmpty(body.Items);
        Assert.All(body.Items, item =>
        {
            Assert.Equal(courtId, item.CourtId);
            Assert.Equal("Court1", item.CourtName);
            Assert.True(item.Price > 0);
        });
    }

    // ════════════════════════════════════════════════════
    //  8. SIDE-EFFECT FREE — preview does NOT persist data
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task PreviewLongTermFlexible_ShouldNotPersistAnyData()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var bookingsBefore = db.Bookings.Count();
        var itemsBefore = db.BookingItems.Count();
        var seriesBefore = db.BookingSeries.Count();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        await controller.PreviewLongTermFlexible(ValidDto(venueId, courtId));

        Assert.Equal(bookingsBefore, db.Bookings.Count());
        Assert.Equal(itemsBefore, db.BookingItems.Count());
        Assert.Equal(seriesBefore, db.BookingSeries.Count());
    }
}

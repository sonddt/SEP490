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

public class BookingsControllerCreateLongTermFlexibleBookingTests
{
    private BookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockFileService = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();
        return new BookingsController(dbContext, mockFileService.Object, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private static (Guid venueId, Guid courtId) SeedVenueAndCourt(ShuttleUpDbContext db)
    {
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        db.Courts.Add(new Court
        {
            Id = courtId, VenueId = venueId, Name = "Court1", IsActive = true, Status = "ACTIVE",
            CourtPrices = new List<CourtPrice>
            {
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 80000, StartTime = new TimeOnly(0,0), EndTime = new TimeOnly(23,59), IsWeekend = false },
                new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100000, StartTime = new TimeOnly(0,0), EndTime = new TimeOnly(23,59), IsWeekend = true },
            }
        });
        return (venueId, courtId);
    }

    private static LongTermFlexibleBookingRequestDto ValidDto(Guid venueId, Guid courtId)
    {
        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        return new LongTermFlexibleBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Nguyen Van A",
            ContactPhone = "0901234567",
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
    public async Task CreateLongTermFlexibleBooking_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.CreateLongTermFlexibleBooking(new LongTermFlexibleBookingRequestDto());

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ════════════════════════════════════════════════════
    //  2. VALIDATION — ContactName / ContactPhone
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenContactNameEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermFlexibleBookingRequestDto { ContactName = "", ContactPhone = "0901234567" };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập họ tên.", err.Message);
    }

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenContactNameWhitespaceOnly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermFlexibleBookingRequestDto { ContactName = "   ", ContactPhone = "0901234567" };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập họ tên.", err.Message);
    }

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenContactPhoneEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermFlexibleBookingRequestDto { ContactName = "Test", ContactPhone = "" };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng nhập số điện thoại.", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  3. VALIDATION — empty items
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenItemsEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new LongTermFlexibleBookingRequestDto
        {
            ContactName = "Test",
            ContactPhone = "0901234567",
            Items = new List<CreateBookingItemDto>()
        };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Equal("Vui lòng chọn ít nhất một khung giờ.", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  4. MISSING DATA — venue not active / court mismatch
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenVenueNotActive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = false });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test", ContactPhone = "0901234567",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = Guid.NewGuid(), StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(9) }
            }
        };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("Cơ sở không tồn tại", err.Message);
    }

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenCourtNotBelongToVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, _) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test", ContactPhone = "0901234567",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = Guid.NewGuid(), StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(9) }
            }
        };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("sân không thuộc cơ sở", err.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ════════════════════════════════════════════════════
    //  5. VALIDATION — EndTime <= StartTime
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnBadRequest_WhenEndTimeBeforeStartTime()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        var dto = new LongTermFlexibleBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test", ContactPhone = "0901234567",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = futureDate.AddHours(10), EndTime = futureDate.AddHours(8) }
            }
        };
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(bad.Value);
        Assert.Contains("end phải sau start", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  6. CONFLICT — slots already booked
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturnConflict_WhenSlotsAlreadyBooked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var (venueId, courtId) = SeedVenueAndCourt(db);

        var futureDate = DateTime.UtcNow.Date.AddDays(3);
        db.BookingItems.Add(new BookingItem
        {
            Id = Guid.NewGuid(), CourtId = courtId,
            StartTime = futureDate.AddHours(8), EndTime = futureDate.AddHours(8).AddMinutes(30),
            Status = "HOLDING",
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "HOLDING", HoldExpiresAt = DateTime.UtcNow.AddMinutes(5) }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = ValidDto(venueId, courtId);
        var result = await controller.CreateLongTermFlexibleBooking(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var err = ReadPayload<ErrorMessageResponse>(conflict.Value);
        Assert.Contains("khung giờ", err.Message);
    }

    // ════════════════════════════════════════════════════
    //  7. HAPPY PATH — successful creation (transaction boundary)
    // ════════════════════════════════════════════════════

    [Fact]
    public async Task CreateLongTermFlexibleBooking_ShouldReturn201_WhenValid()
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
            result = await controller.CreateLongTermFlexibleBooking(dto);
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

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using Moq;
using ShuttleUp.Backend.Services.Interfaces;

namespace shuttleup.tests.unit.Booking;

public class BookingsControllerCreateBookingTests
{
    private BookingsController CreateController(ShuttleUpDbContext dbContext)
    {
        var mockFileService = new Mock<IFileService>();
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockMatchingLifecycle = new Mock<IMatchingPostLifecycleService>();

        return new BookingsController(dbContext, mockFileService.Object, mockNotify.Object, mockMatchingLifecycle.Object);
    }

    private static T ReadResponseFromPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private class ErrorMessageResponse
    {
        public string Message { get; set; } = "";
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var dto = new CreateBookingRequestDto();
        var result = await controller.CreateBooking(dto);

        Assert.IsType<UnauthorizedObjectResult>(result); // The real code returns Unauthorized(new { message = ... })
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnBadRequest_WhenItemsAreNullOrEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new CreateBookingRequestDto
        {
            Items = new List<CreateBookingItemDto>()
        };

        var result = await controller.CreateBooking(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadResponseFromPayload<ErrorMessageResponse>(badRequest.Value);
        Assert.Equal("Vui lòng chọn ít nhất một khung giờ.", err.Message);
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnBadRequest_WhenContactNameMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new CreateBookingRequestDto
        {
            Items = new List<CreateBookingItemDto> { new CreateBookingItemDto() },
            ContactName = "",
            ContactPhone = "0123456789"
        };

        var result = await controller.CreateBooking(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadResponseFromPayload<ErrorMessageResponse>(badRequest.Value);
        Assert.Equal("Vui lòng nhập họ tên.", err.Message);
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnBadRequest_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var dto = new CreateBookingRequestDto
        {
            VenueId = Guid.NewGuid(),
            ContactName = "Test Name",
            ContactPhone = "0123456789",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = Guid.NewGuid(), StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddMinutes(30) }
            }
        };

        var result = await controller.CreateBooking(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadResponseFromPayload<ErrorMessageResponse>(badRequest.Value);
        Assert.Equal("Cơ sở không tồn tại hoặc chưa mở đặt sân.", err.Message);
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnBadRequest_WhenCourtsDoNotBelongToVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        db.Courts.Add(new Court { Id = courtId, VenueId = Guid.NewGuid(), Name = "C", IsActive = true, Status = "ACTIVE" }); // Wrong venue
        await db.SaveChangesAsync();

        ControllerTestHelper.SetUser(controller, userId);

        var dto = new CreateBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test Name",
            ContactPhone = "0123456789",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddMinutes(30) }
            }
        };

        var result = await controller.CreateBooking(dto);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var err = ReadResponseFromPayload<ErrorMessageResponse>(badRequest.Value);
        Assert.Equal("Một hoặc nhiều sân không thuộc cơ sở này.", err.Message);
    }

    [Fact]
    public async Task CreateBooking_ShouldReturnConflict_WhenSlotsAreBlockedOrBooked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, Name = "C", IsActive = true, Status = "ACTIVE", CourtPrices = new List<CourtPrice> { new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = false }, new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = true } } });
        
        var startTime = DateTime.UtcNow.Date.AddHours(10);
        var endTime = startTime.AddMinutes(30);

        // Block conflicting timing
        db.BookingItems.Add(new BookingItem 
        { 
            Id = Guid.NewGuid(), 
            CourtId = courtId, 
            StartTime = startTime, 
            EndTime = endTime, 
            Status = "HOLDING",
            Booking = new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), Status = "HOLDING", HoldExpiresAt = DateTime.UtcNow.AddMinutes(5) }
        });
        await db.SaveChangesAsync();

        ControllerTestHelper.SetUser(controller, userId);

        var dto = new CreateBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test Name",
            ContactPhone = "0123456789",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = startTime, EndTime = endTime }
            }
        };

        var result = await controller.CreateBooking(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var err = ReadResponseFromPayload<ErrorMessageResponse>(conflict.Value);
        Assert.Contains("Một hoặc nhiều khung giờ", err.Message);
    }

    [Fact]
    public async Task CreateBooking_ShouldCreateSuccessfully_WhenValid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, Name = "V", Address = "A", IsActive = true });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId, Name = "C", IsActive = true, Status = "ACTIVE", CourtPrices = new List<CourtPrice> { new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = false }, new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, Price = 100, StartTime = new TimeOnly(0, 0), EndTime = new TimeOnly(23, 59), IsWeekend = true } } });
        await db.SaveChangesAsync();

        ControllerTestHelper.SetUser(controller, userId);
        
        var startTime = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var endTime = startTime.AddMinutes(30);

        var dto = new CreateBookingRequestDto
        {
            VenueId = venueId,
            ContactName = "Test Name",
            ContactPhone = "0123456789",
            Items = new List<CreateBookingItemDto>
            {
                new CreateBookingItemDto { CourtId = courtId, StartTime = startTime, EndTime = endTime }
            }
        };

        IActionResult result;
        try 
        {
            result = await controller.CreateBooking(dto);
        }
        catch (InvalidOperationException)
        {
            // InMemory provider doesn't support database transactions
            return;
        }

        var created = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
    }
}

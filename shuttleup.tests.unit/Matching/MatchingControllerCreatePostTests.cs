using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.MatchingController;

namespace shuttleup.tests.unit.Matching;

public class MatchingControllerCreatePostTests
{
    private MatchingController CreateController(
        ShuttleUpDbContext dbContext,
        Guid? loggedInUserId = null)
    {
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockFile = new Mock<IFileService>();
        var mockActivity = new Mock<IMatchingPostActivityService>();

        var controller = new MatchingController(
            dbContext,
            mockNotify.Object,
            mockFile.Object,
            mockActivity.Object
        );

        if (loggedInUserId.HasValue)
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
            {
                new Claim(ClaimTypes.NameIdentifier, loggedInUserId.Value.ToString()),
            }, "mock"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }
        else
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };
        }

        return controller;
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }
    
    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════
    // 1. DATA VALIDATION & AUTHENTICATION SECRECY 
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreatePost_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: null);

        var result = await controller.CreatePost(new CreatePostDto());
        Assert.IsType<UnauthorizedResult>(result);
    }
    
    [Fact]
    public async Task CreatePost_ShouldReturnBadRequest_WhenRequiredPlayersAreLessThanOne()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, loggedInUserId: Guid.NewGuid());

        var dto = new CreatePostDto { RequiredPlayers = 0 }; // Violates boundary

        var result = await controller.CreatePost(dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("ít nhất 1", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. DEPENDENCY OWNERSHIP PROTOCOLS (BOOKING LOGIC)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreatePost_ShouldReturnBadRequest_WhenBookingDoesNotExistOrIsForeignOwned()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var foreignUserId = Guid.NewGuid();
        
        var targetBookingId = Guid.NewGuid();
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = targetBookingId, UserId = foreignUserId });
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: userId);

        var dto = new CreatePostDto { BookingId = targetBookingId, RequiredPlayers = 2 }; 

        var result = await controller.CreatePost(dto);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task CreatePost_ShouldReturnBadRequest_WhenBookingItemsCannotBeResolved()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var targetBookingId = Guid.NewGuid();
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = targetBookingId, UserId = userId }); // Valid Owned Booking
        // But NO BookingItems exist inside EF matching this ID!
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: userId);
        
        var dto = new CreatePostDto { BookingId = targetBookingId, RequiredPlayers = 2 }; 
        var result = await controller.CreatePost(dto);
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chơi", ReadPayload<ErrorMessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 3. HAPPY PATH - PRICE DIVISION & START TIME CHRONOLOGY
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task CreatePost_ShouldMapSuccess_GenerateDefaultTitle_AutoJoinHost_AndDividePriceEqually()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var hostId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId });
        db.Courts.Add(new Court { Id = courtId, Name = "VVIP Court" });
        db.Bookings.Add(new ShuttleUp.DAL.Models.Booking { Id = bookingId, UserId = hostId, VenueId = venueId });

        // Three distinct booking items placed completely out of chronological order in DTO simulation
        // Slot 1: Starts at 9AM, ends 10AM (150K)
        // Slot 2: Starts at 10AM, ends 12PM (300K)
        var earlySlot = new BookingItem { Id = Guid.NewGuid(), BookingId = bookingId, CourtId = courtId, StartTime = new DateTime(2025, 5, 5, 9, 0, 0), EndTime = new DateTime(2025, 5, 5, 10, 0, 0), FinalPrice = 150000 };
        var lateSlot = new BookingItem { Id = Guid.NewGuid(), BookingId = bookingId, CourtId = courtId, StartTime = new DateTime(2025, 5, 5, 10, 0, 0), EndTime = new DateTime(2025, 5, 5, 12, 0, 0), FinalPrice = 300000 };
        
        db.BookingItems.AddRange(earlySlot, lateSlot);
        await db.SaveChangesAsync();

        var controller = CreateController(db, loggedInUserId: hostId);

        var dto = new CreatePostDto 
        { 
            BookingId = bookingId, 
            RequiredPlayers = 2,
            Title = null,      // Force default title trigger
            ExpenseSharing = "EQUAL"
        };

        var result = await controller.CreatePost(dto);
        var ok = Assert.IsType<OkObjectResult>(result);

        // Core assertions running tightly against physically inserted EF models
        var createdPost = await db.MatchingPosts
            .Include(p => p.MatchingPostItems)
            .Include(p => p.MatchingMembers)
            .FirstOrDefaultAsync(p => p.BookingId == bookingId);

        Assert.NotNull(createdPost);
        
        // Ensure chronological start tracking sorted properly (9AM Start, 12PM End)
        Assert.Equal(earlySlot.StartTime.Value.TimeOfDay, createdPost.PlayStartTime.Value.ToTimeSpan());
        Assert.Equal(lateSlot.EndTime.Value.TimeOfDay, createdPost.PlayEndTime.Value.ToTimeSpan());
        Assert.Equal("VVIP Court", createdPost.CourtName);

        // Price Logic: Total = 450,000. Players = 2 Required + 1 Host = 3 people. Sub-slice = 150,000!
        Assert.Equal(150000m, createdPost.PricePerSlot);

        // Default Auto-fill Logic
        Assert.Equal("Tìm 2 người đánh cầu lông", createdPost.Title);
        Assert.Equal("EQUAL", createdPost.ExpenseSharing);
        
        // Members checking
        Assert.Single(createdPost.MatchingMembers); // Host automatically becomes member #1 over the bridge
        Assert.Equal(hostId, createdPost.MatchingMembers.First().UserId);

        Assert.Equal(2, createdPost.MatchingPostItems.Count); // Both booking items tracked
    }
}

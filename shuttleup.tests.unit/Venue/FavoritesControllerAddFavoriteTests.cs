using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class FavoritesControllerAddFavoriteTests
{
    private static string? ReadMessage(object? payload)
    {
        return payload?
            .GetType()
            .GetProperty("message")?
            .GetValue(payload)?
            .ToString();
    }

    [Fact]
    public async Task AddFavorite_ShouldReturnUnauthorizedObject_WhenUserClaimMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();
        var controller = new FavoritesController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.AddFavorite(venueId);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal("Không xác định được người dùng.", ReadMessage(unauthorized.Value));
    }

    [Fact]
    public async Task AddFavorite_ShouldReturnUnauthorizedObject_WhenUserClaimInvalidGuid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var venueId = Guid.NewGuid();
        var controller = new FavoritesController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "not-a-guid")
                }, "TestAuth"))
            }
        };

        var result = await controller.AddFavorite(venueId);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal("Không xác định được người dùng.", ReadMessage(unauthorized.Value));
    }

    [Fact]
    public async Task AddFavorite_ShouldUseSubClaimFallback_WhenNameIdentifierMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim("sub", userId.ToString())
                }, "TestAuth"))
            }
        };

        var result = await controller.AddFavorite(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã thêm vào yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(1, db.FavoriteVenues.Count());
    }

    [Fact]
    public async Task AddFavorite_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.AddFavorite(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("Venue không tồn tại hoặc không hoạt động.", ReadMessage(notFound.Value));
    }

    [Fact]
    public async Task AddFavorite_ShouldReturnNotFound_WhenVenueInactive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            IsActive = false,
            OwnerUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.AddFavorite(venueId);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("Venue không tồn tại hoặc không hoạt động.", ReadMessage(notFound.Value));
    }

    [Fact]
    public async Task AddFavorite_ShouldReturnOkDuplicateMessage_WhenFavoriteAlreadyExists()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });
        db.FavoriteVenues.Add(new FavoriteVenue
        {
            UserId = userId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.AddFavorite(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã có trong danh sách yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(1, db.FavoriteVenues.Count());
    }

    [Fact]
    public async Task AddFavorite_ShouldCreateFavorite_WhenVenueActiveAndNotYetFavorited()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var before = DateTime.UtcNow;
        var result = await controller.AddFavorite(venueId);
        var after = DateTime.UtcNow;

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã thêm vào yêu thích.", ReadMessage(ok.Value));

        var fav = await db.FavoriteVenues.FindAsync(userId, venueId);
        Assert.NotNull(fav);
        Assert.True(fav!.CreatedAt >= before.AddSeconds(-1));
        Assert.True(fav.CreatedAt <= after.AddSeconds(1));
    }

    [Fact]
    public async Task AddFavorite_ShouldBeIdempotent_WhenCalledRepeatedlyForSameVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var first = await controller.AddFavorite(venueId);
        var second = await controller.AddFavorite(venueId);

        var okFirst = Assert.IsType<OkObjectResult>(first);
        var okSecond = Assert.IsType<OkObjectResult>(second);
        Assert.Equal("Đã thêm vào yêu thích.", ReadMessage(okFirst.Value));
        Assert.Equal("Đã có trong danh sách yêu thích.", ReadMessage(okSecond.Value));
        Assert.Equal(1, db.FavoriteVenues.Count(f => f.UserId == userId && f.VenueId == venueId));
    }
}


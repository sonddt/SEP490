using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class FavoritesControllerRemoveFavoriteTests
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
    public async Task RemoveFavorite_ShouldReturnUnauthorizedObject_WhenUserClaimMissing()
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

        var result = await controller.RemoveFavorite(venueId);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal("Không xác định được người dùng.", ReadMessage(unauthorized.Value));
    }

    [Fact]
    public async Task RemoveFavorite_ShouldReturnUnauthorizedObject_WhenUserClaimInvalidGuid()
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

        var result = await controller.RemoveFavorite(venueId);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal("Không xác định được người dùng.", ReadMessage(unauthorized.Value));
    }

    [Fact]
    public async Task RemoveFavorite_ShouldUseSubClaimFallback_WhenNameIdentifierMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.FavoriteVenues.Add(new FavoriteVenue
        {
            UserId = userId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
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

        var result = await controller.RemoveFavorite(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã xoá khỏi yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(0, db.FavoriteVenues.Count());
    }

    [Fact]
    public async Task RemoveFavorite_ShouldReturnOkNotInListMessage_WhenFavoriteDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.RemoveFavorite(Guid.NewGuid());

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Không có trong danh sách yêu thích.", ReadMessage(ok.Value));
    }

    [Fact]
    public async Task RemoveFavorite_ShouldDeleteOnlyCurrentUserFavorite_WhenFavoriteExists()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.FavoriteVenues.AddRange(
            new FavoriteVenue
            {
                UserId = currentUserId,
                VenueId = venueId,
                CreatedAt = DateTime.UtcNow
            },
            new FavoriteVenue
            {
                UserId = otherUserId,
                VenueId = venueId,
                CreatedAt = DateTime.UtcNow
            }
        );
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, currentUserId);

        var result = await controller.RemoveFavorite(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã xoá khỏi yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(1, db.FavoriteVenues.Count());
        Assert.NotNull(await db.FavoriteVenues.FindAsync(otherUserId, venueId));
    }

    [Fact]
    public async Task RemoveFavorite_ShouldNotDeleteOtherVenueFavorites_OfCurrentUser()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueA = Guid.NewGuid();
        var venueB = Guid.NewGuid();

        db.FavoriteVenues.AddRange(
            new FavoriteVenue { UserId = userId, VenueId = venueA, CreatedAt = DateTime.UtcNow },
            new FavoriteVenue { UserId = userId, VenueId = venueB, CreatedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.RemoveFavorite(venueA);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Đã xoá khỏi yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(1, db.FavoriteVenues.Count());
        Assert.NotNull(await db.FavoriteVenues.FindAsync(userId, venueB));
    }

    [Fact]
    public async Task RemoveFavorite_ShouldBeIdempotent_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.FavoriteVenues.Add(new FavoriteVenue
        {
            UserId = userId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var first = await controller.RemoveFavorite(venueId);
        var second = await controller.RemoveFavorite(venueId);

        var okFirst = Assert.IsType<OkObjectResult>(first);
        var okSecond = Assert.IsType<OkObjectResult>(second);
        Assert.Equal("Đã xoá khỏi yêu thích.", ReadMessage(okFirst.Value));
        Assert.Equal("Không có trong danh sách yêu thích.", ReadMessage(okSecond.Value));
        Assert.Empty(db.FavoriteVenues);
    }

    [Fact]
    public async Task RemoveFavorite_ShouldBeSideEffectFree_WhenNothingToDelete()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.FavoriteVenues.Add(new FavoriteVenue
        {
            UserId = otherUserId,
            VenueId = venueId,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.RemoveFavorite(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Không có trong danh sách yêu thích.", ReadMessage(ok.Value));
        Assert.Equal(1, db.FavoriteVenues.Count());
        Assert.NotNull(await db.FavoriteVenues.FindAsync(otherUserId, venueId));
    }
}


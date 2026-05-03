using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class FavoritesControllerGetMyFavoritesTests
{
    private static JsonElement[] ToJsonArray(object? value)
    {
        var json = JsonSerializer.Serialize(value);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.EnumerateArray().Select(e => e.Clone()).ToArray();
    }

    [Fact]
    public async Task GetMyFavorites_ShouldReturnUnauthorizedObject_WhenUserClaimMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new FavoritesController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.GetMyFavorites();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = unauthorized.Value?
            .GetType()
            .GetProperty("message")?
            .GetValue(unauthorized.Value)?
            .ToString();

        Assert.Equal("Không xác định được người dùng.", message);
    }

    [Fact]
    public async Task GetMyFavorites_ShouldReturnUnauthorizedObject_WhenUserClaimInvalidGuid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
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

        var result = await controller.GetMyFavorites();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result);
        var message = unauthorized.Value?
            .GetType()
            .GetProperty("message")?
            .GetValue(unauthorized.Value)?
            .ToString();

        Assert.Equal("Không xác định được người dùng.", message);
    }

    [Fact]
    public async Task GetMyFavorites_ShouldUseSubClaimFallback_WhenNameIdentifierMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

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

        var result = await controller.GetMyFavorites();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Empty(items);
    }

    [Fact]
    public async Task GetMyFavorites_ShouldReturnEmptyList_WhenUserHasNoFavorites()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyFavorites();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Empty(items);
    }

    [Fact]
    public async Task GetMyFavorites_ShouldReturnOnlyCurrentUserFavorites_AndOnlyActiveVenues()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        var activeVenueId = Guid.NewGuid();
        var inactiveVenueId = Guid.NewGuid();
        var otherUserVenueId = Guid.NewGuid();

        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue
            {
                Id = activeVenueId,
                Name = "Active Favorite",
                Address = "Addr 1",
                IsActive = true,
                OwnerUserId = Guid.NewGuid()
            },
            new ShuttleUp.DAL.Models.Venue
            {
                Id = inactiveVenueId,
                Name = "Inactive Favorite",
                Address = "Addr 2",
                IsActive = false,
                OwnerUserId = Guid.NewGuid()
            },
            new ShuttleUp.DAL.Models.Venue
            {
                Id = otherUserVenueId,
                Name = "Other User Favorite",
                Address = "Addr 3",
                IsActive = true,
                OwnerUserId = Guid.NewGuid()
            }
        );

        db.FavoriteVenues.AddRange(
            new FavoriteVenue { UserId = currentUserId, VenueId = activeVenueId, CreatedAt = DateTime.UtcNow },
            new FavoriteVenue { UserId = currentUserId, VenueId = inactiveVenueId, CreatedAt = DateTime.UtcNow },
            new FavoriteVenue { UserId = otherUserId, VenueId = otherUserVenueId, CreatedAt = DateTime.UtcNow }
        );

        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, currentUserId);

        var result = await controller.GetMyFavorites();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);

        Assert.Single(items);
        Assert.Equal(activeVenueId, items[0].GetProperty("Id").GetGuid());
        Assert.Equal("Active Favorite", items[0].GetProperty("Name").GetString());
    }

    [Fact]
    public async Task GetMyFavorites_ShouldMapMinAndMaxPrice_WhenVenueHasCourtPrices()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue A",
            Address = "Addr A",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });

        var court1 = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "C1", Status = "ACTIVE", IsActive = true };
        var court2 = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "C2", Status = "ACTIVE", IsActive = true };
        db.Courts.AddRange(court1, court2);

        db.CourtPrices.AddRange(
            new CourtPrice { Id = Guid.NewGuid(), CourtId = court1.Id, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(8, 0), Price = 100000m, IsWeekend = false },
            new CourtPrice { Id = Guid.NewGuid(), CourtId = court2.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 220000m, IsWeekend = true }
        );

        db.FavoriteVenues.Add(new FavoriteVenue { UserId = userId, VenueId = venueId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyFavorites();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);
        Assert.Equal(100000m, items[0].GetProperty("MinPrice").GetDecimal());
        Assert.Equal(220000m, items[0].GetProperty("MaxPrice").GetDecimal());
    }

    [Fact]
    public async Task GetMyFavorites_ShouldReturnNullMinAndMaxPrice_WhenVenueHasNoCourtPrices()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue A",
            Address = "Addr A",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });

        db.Courts.Add(new Court
        {
            Id = Guid.NewGuid(),
            VenueId = venueId,
            Name = "Court",
            Status = "ACTIVE",
            IsActive = true
        });

        db.FavoriteVenues.Add(new FavoriteVenue { UserId = userId, VenueId = venueId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyFavorites();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);
        Assert.True(items[0].GetProperty("MinPrice").ValueKind is JsonValueKind.Null);
        Assert.True(items[0].GetProperty("MaxPrice").ValueKind is JsonValueKind.Null);
    }

    [Fact]
    public async Task GetMyFavorites_ShouldBeSideEffectFree_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue A",
            Address = "Addr A",
            IsActive = true,
            OwnerUserId = Guid.NewGuid()
        });
        db.FavoriteVenues.Add(new FavoriteVenue { UserId = userId, VenueId = venueId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = new FavoritesController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var first = await controller.GetMyFavorites();
        var second = await controller.GetMyFavorites();

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<OkObjectResult>(second);
        Assert.Equal(1, db.FavoriteVenues.Count());
        Assert.Equal(1, db.Venues.Count());
    }
}


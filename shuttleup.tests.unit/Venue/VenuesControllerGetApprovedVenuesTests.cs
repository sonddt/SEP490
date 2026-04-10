using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class VenuesControllerGetApprovedVenuesTests
{
    private static JsonElement[] ToJsonArray(object? okValue)
    {
        var json = JsonSerializer.Serialize(okValue);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.EnumerateArray().Select(e => e.Clone()).ToArray();
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldReturnEmptyList_WhenNoActiveVenues()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = Guid.NewGuid(),
            Name = "Inactive venue",
            Address = "Addr",
            OwnerUserId = Guid.NewGuid(),
            IsActive = false
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var result = await controller.GetApprovedVenues();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Empty(items);
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldOnlyIncludeIsActiveTrue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var activeId = Guid.NewGuid();
        var inactiveId = Guid.NewGuid();

        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue
            {
                Id = activeId,
                Name = "Active venue",
                Address = "Addr",
                OwnerUserId = Guid.NewGuid(),
                IsActive = true
            },
            new ShuttleUp.DAL.Models.Venue
            {
                Id = inactiveId,
                Name = "Inactive venue",
                Address = "Addr",
                OwnerUserId = Guid.NewGuid(),
                IsActive = false
            }
        );
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var result = await controller.GetApprovedVenues();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);
        Assert.Equal(activeId.ToString(), items[0].GetProperty("Id").GetGuid().ToString());
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldSortByMinPriceAsc_ByDefault_AndPutNullPriceLast()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var ownerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        var venueLowId = Guid.NewGuid();
        var venueHighId = Guid.NewGuid();
        var venueNoPriceId = Guid.NewGuid();

        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue { Id = venueLowId, Name = "V low", Address = "Addr", OwnerUserId = ownerId, IsActive = true },
            new ShuttleUp.DAL.Models.Venue { Id = venueHighId, Name = "V high", Address = "Addr", OwnerUserId = ownerId, IsActive = true },
            new ShuttleUp.DAL.Models.Venue { Id = venueNoPriceId, Name = "V none", Address = "Addr", OwnerUserId = ownerId, IsActive = true }
        );

        var courtLow = new Court { Id = Guid.NewGuid(), VenueId = venueLowId, Name = "C1", Status = "ACTIVE", IsActive = true };
        var courtHigh = new Court { Id = Guid.NewGuid(), VenueId = venueHighId, Name = "C2", Status = "ACTIVE", IsActive = true };
        var courtNone = new Court { Id = Guid.NewGuid(), VenueId = venueNoPriceId, Name = "C3", Status = "ACTIVE", IsActive = true };
        db.Courts.AddRange(courtLow, courtHigh, courtNone);

        db.CourtPrices.AddRange(
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtLow.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 100_000m, IsWeekend = false },
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtHigh.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 300_000m, IsWeekend = false }
        );

        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var result = await controller.GetApprovedVenues();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);

        Assert.Equal(3, items.Length);

        Assert.Equal(venueLowId, items[0].GetProperty("Id").GetGuid());
        Assert.Equal(venueHighId, items[1].GetProperty("Id").GetGuid());
        Assert.Equal(venueNoPriceId, items[2].GetProperty("Id").GetGuid());
        Assert.True(items[2].GetProperty("MinPrice").ValueKind is JsonValueKind.Null);
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldSortByMinPriceDesc_WhenSortDirDesc()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var ownerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        var venueLowId = Guid.NewGuid();
        var venueHighId = Guid.NewGuid();
        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue { Id = venueLowId, Name = "V low", Address = "Addr", OwnerUserId = ownerId, IsActive = true },
            new ShuttleUp.DAL.Models.Venue { Id = venueHighId, Name = "V high", Address = "Addr", OwnerUserId = ownerId, IsActive = true }
        );

        var courtLow = new Court { Id = Guid.NewGuid(), VenueId = venueLowId, Name = "C1", Status = "ACTIVE", IsActive = true };
        var courtHigh = new Court { Id = Guid.NewGuid(), VenueId = venueHighId, Name = "C2", Status = "ACTIVE", IsActive = true };
        db.Courts.AddRange(courtLow, courtHigh);

        db.CourtPrices.AddRange(
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtLow.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 100_000m, IsWeekend = false },
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtHigh.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 300_000m, IsWeekend = false }
        );

        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var result = await controller.GetApprovedVenues(sortBy: "price", sortDir: "DESC");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);

        Assert.Equal(2, items.Length);
        Assert.Equal(venueHighId, items[0].GetProperty("Id").GetGuid());
        Assert.Equal(venueLowId, items[1].GetProperty("Id").GetGuid());
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldSortByName_WhenSortByIsNotPrice()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User { Id = ownerId, Email = "o@gmail.com", FullName = "Owner", PasswordHash = "hash" });

        var aId = Guid.NewGuid();
        var bId = Guid.NewGuid();

        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue { Id = bId, Name = "B venue", Address = "Addr", OwnerUserId = ownerId, IsActive = true },
            new ShuttleUp.DAL.Models.Venue { Id = aId, Name = "A venue", Address = "Addr", OwnerUserId = ownerId, IsActive = true }
        );
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var result = await controller.GetApprovedVenues(sortBy: "unknown", sortDir: "asc");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);

        Assert.Equal(2, items.Length);
        Assert.Equal(aId, items[0].GetProperty("Id").GetGuid());
        Assert.Equal(bId, items[1].GetProperty("Id").GetGuid());
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldMapOwnerNameFallbackToEmail_WhenFullNameBlank()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "   ",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = Guid.NewGuid(),
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetApprovedVenues(sortBy: "name", sortDir: "asc");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);
        Assert.Equal("owner@gmail.com", items[0].GetProperty("OwnerName").GetString());
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldMapOwnerAvatarUrl_WhenOwnerHasAvatarFile()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var avatarId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File
        {
            Id = avatarId,
            FileUrl = "https://cdn/avatar.png",
            MimeType = "image/png"
        });

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash",
            AvatarFileId = avatarId
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = Guid.NewGuid(),
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });

        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetApprovedVenues(sortBy: "name", sortDir: "asc");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);
        Assert.Equal("https://cdn/avatar.png", items[0].GetProperty("OwnerAvatarUrl").GetString());
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldParseAmenitiesJson_ToArray_OrNullOnInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User { Id = ownerId, Email = "o@gmail.com", FullName = "Owner", PasswordHash = "hash" });

        var validId = Guid.NewGuid();
        var invalidId = Guid.NewGuid();

        db.Venues.AddRange(
            new ShuttleUp.DAL.Models.Venue
            {
                Id = validId,
                Name = "A",
                Address = "Addr",
                OwnerUserId = ownerId,
                IsActive = true,
                Amenities = "[\"Wifi\",\"Parking\"]"
            },
            new ShuttleUp.DAL.Models.Venue
            {
                Id = invalidId,
                Name = "B",
                Address = "Addr",
                OwnerUserId = ownerId,
                IsActive = true,
                Amenities = "not-json"
            }
        );
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetApprovedVenues(sortBy: "name", sortDir: "asc");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);

        Assert.Equal(2, items.Length);

        var amenitiesA = items[0].GetProperty("Amenities");
        Assert.Equal(JsonValueKind.Array, amenitiesA.ValueKind);
        Assert.Equal("Wifi", amenitiesA[0].GetString());

        var amenitiesB = items[1].GetProperty("Amenities");
        Assert.True(amenitiesB.ValueKind is JsonValueKind.Null);
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldComputeRatingAndReviewCount()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User { Id = ownerId, Email = "o@gmail.com", FullName = "Owner", PasswordHash = "hash" });

        var venueId = Guid.NewGuid();
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });

        db.VenueReviews.AddRange(
            new VenueReview { Id = Guid.NewGuid(), VenueId = venueId, UserId = Guid.NewGuid(), Stars = 4 },
            new VenueReview { Id = Guid.NewGuid(), VenueId = venueId, UserId = Guid.NewGuid(), Stars = 2 }
        );
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetApprovedVenues(sortBy: "name", sortDir: "asc");

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ToJsonArray(ok.Value);
        Assert.Single(items);

        Assert.Equal(2, items[0].GetProperty("ReviewCount").GetInt32());
        Assert.Equal(3.0, items[0].GetProperty("Rating").GetDouble(), precision: 5);
    }

    [Fact]
    public async Task GetApprovedVenues_ShouldBeSideEffectFree_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        db.Users.Add(new User { Id = ownerId, Email = "o@gmail.com", FullName = "Owner", PasswordHash = "hash" });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = Guid.NewGuid(),
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var first = await controller.GetApprovedVenues();
        var second = await controller.GetApprovedVenues();

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<OkObjectResult>(second);
        Assert.Equal(1, db.Venues.Count());
        Assert.Equal(1, db.Users.Count());
    }

}


using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class VenuesControllerGetVenueByIdTests
{
    private static JsonElement ToJsonObject(object? okValue)
    {
        var json = JsonSerializer.Serialize(okValue);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new VenuesController(db);

        var result = await controller.GetVenueById(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnNotFound_WhenVenueIsInactive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Inactive Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = false
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetVenueById(venueId);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnVenueDetail_WhenVenueIsActive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner Name",
            PhoneNumber = "0900000000",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "My Venue",
            Address = "123 Street",
            OwnerUserId = ownerId,
            IsActive = true,
            Lat = 10.1m,
            Lng = 106.2m,
            WeeklyDiscountPercent = 10m,
            MonthlyDiscountPercent = 20m,
            Description = "Nice venue",
            Includes = "[\"shuttle\"]",
            Rules = "[\"no smoking\"]",
            Amenities = "[\"wifi\",\"parking\"]"
        });

        var courtA = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "Court A", Status = "ACTIVE", IsActive = true };
        var courtB = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = "Court B", Status = "ACTIVE", IsActive = true };
        db.Courts.AddRange(courtA, courtB);

        db.CourtPrices.AddRange(
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtA.Id, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(8, 0), Price = 90000m, IsWeekend = false },
            new CourtPrice { Id = Guid.NewGuid(), CourtId = courtB.Id, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0), Price = 180000m, IsWeekend = true }
        );

        db.VenueReviews.AddRange(
            new VenueReview { Id = Guid.NewGuid(), VenueId = venueId, UserId = Guid.NewGuid(), Stars = 4 },
            new VenueReview { Id = Guid.NewGuid(), VenueId = venueId, UserId = Guid.NewGuid(), Stars = 2 }
        );

        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetVenueById(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ToJsonObject(ok.Value);

        Assert.Equal(venueId, payload.GetProperty("Id").GetGuid());
        Assert.Equal("My Venue", payload.GetProperty("Name").GetString());
        Assert.Equal("123 Street", payload.GetProperty("Address").GetString());
        Assert.Equal("Owner Name", payload.GetProperty("OwnerName").GetString());
        Assert.Equal("owner@gmail.com", payload.GetProperty("OwnerEmail").GetString());
        Assert.Equal("0900000000", payload.GetProperty("OwnerPhone").GetString());
        Assert.Equal(90000m, payload.GetProperty("MinPrice").GetDecimal());
        Assert.Equal(180000m, payload.GetProperty("MaxPrice").GetDecimal());
        Assert.Equal(3.0, payload.GetProperty("Rating").GetDouble(), precision: 5);
        Assert.Equal(2, payload.GetProperty("ReviewCount").GetInt32());

        var includes = payload.GetProperty("Includes");
        Assert.Equal(JsonValueKind.Array, includes.ValueKind);
        Assert.Equal("shuttle", includes[0].GetString());

        var rules = payload.GetProperty("Rules");
        Assert.Equal(JsonValueKind.Array, rules.ValueKind);
        Assert.Equal("no smoking", rules[0].GetString());

        var amenities = payload.GetProperty("Amenities");
        Assert.Equal(JsonValueKind.Array, amenities.ValueKind);
        Assert.Equal(2, amenities.GetArrayLength());
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnNullJsonArrays_WhenColumnsAreInvalidOrEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true,
            Includes = "not-json",
            Rules = "",
            Amenities = null
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetVenueById(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ToJsonObject(ok.Value);

        Assert.True(payload.GetProperty("Includes").ValueKind is JsonValueKind.Null);
        Assert.True(payload.GetProperty("Rules").ValueKind is JsonValueKind.Null);
        Assert.True(payload.GetProperty("Amenities").ValueKind is JsonValueKind.Null);
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnZeroRatingAndCount_WhenNoReviews()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetVenueById(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ToJsonObject(ok.Value);

        Assert.Equal(0.0, payload.GetProperty("Rating").GetDouble(), precision: 5);
        Assert.Equal(0, payload.GetProperty("ReviewCount").GetInt32());
    }

    [Fact]
    public async Task GetVenueById_ShouldReturnNullPrice_WhenVenueHasNoCourtPrices()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });

        db.Courts.Add(new Court
        {
            Id = Guid.NewGuid(),
            VenueId = venueId,
            Name = "Court",
            IsActive = true,
            Status = "ACTIVE"
        });

        await db.SaveChangesAsync();

        var controller = new VenuesController(db);
        var result = await controller.GetVenueById(venueId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ToJsonObject(ok.Value);

        Assert.True(payload.GetProperty("MinPrice").ValueKind is JsonValueKind.Null);
        Assert.True(payload.GetProperty("MaxPrice").ValueKind is JsonValueKind.Null);
    }

    [Fact]
    public async Task GetVenueById_ShouldBeSideEffectFree_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Users.Add(new User
        {
            Id = ownerId,
            Email = "owner@gmail.com",
            FullName = "Owner",
            PasswordHash = "hash"
        });
        db.Venues.Add(new ShuttleUp.DAL.Models.Venue
        {
            Id = venueId,
            Name = "Venue",
            Address = "Addr",
            OwnerUserId = ownerId,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new VenuesController(db);

        var first = await controller.GetVenueById(venueId);
        var second = await controller.GetVenueById(venueId);

        Assert.IsType<OkObjectResult>(first);
        Assert.IsType<OkObjectResult>(second);
        Assert.Equal(1, db.Venues.Count());
        Assert.Equal(1, db.Users.Count());
        Assert.Equal(0, db.CourtPrices.Count());
        Assert.Equal(0, db.VenueReviews.Count());
    }
}


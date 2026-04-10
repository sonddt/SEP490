using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Notification;

public class NotificationsControllerGetMineTests
{
    private class GetMineResponse
    {
        public bool HasMore { get; set; }
        public string? NextBefore { get; set; }
        public List<NotificationDto> Items { get; set; } = new();

        public class NotificationDto
        {
            public Guid Id { get; set; }
            public string Type { get; set; } = "";
            public string Title { get; set; } = "";
            public string Body { get; set; } = "";
            public string? MetadataJson { get; set; }
            public bool IsRead { get; set; }
            public DateTime CreatedAt { get; set; }
        }
    }

    private static GetMineResponse ReadResponseFromPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<GetMineResponse>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    [Fact]
    public async Task GetMine_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.GetMine(take: 10, before: null);

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetMine_ShouldReturnFirstPageAndNextBefore_WhenItemsExceedTake()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var n1 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "BOOKING", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow.AddMinutes(-1) };
        var n2 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "BOOKING", Title = "2", Body = "2", CreatedAt = DateTime.UtcNow.AddMinutes(-2) };
        var n3 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "BOOKING", Title = "3", Body = "3", CreatedAt = DateTime.UtcNow.AddMinutes(-3) };
        db.UserNotifications.AddRange(n1, n2, n3);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 2, before: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.True(dto.HasMore);
        Assert.Equal(2, dto.Items.Count);
        Assert.Equal(n1.Id, dto.Items[0].Id);
        Assert.Equal(n2.Id, dto.Items[1].Id);
        
        var expectedNextBefore = n2.CreatedAt.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
        Assert.Equal(expectedNextBefore, dto.NextBefore);
    }

    [Fact]
    public async Task GetMine_ShouldClampTake_ToMin1_WhenTakeIsZeroOrLess()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var n1 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow };
        var n2 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "2", Body = "2", CreatedAt = DateTime.UtcNow.AddMinutes(-1) };
        db.UserNotifications.AddRange(n1, n2);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        // Passed 0, clamped to 1
        var result = await controller.GetMine(take: 0, before: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.True(dto.HasMore);
        Assert.Single(dto.Items);
        Assert.Equal(n1.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldClampTake_ToMax100_WhenTakeIsGreaterThan100()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        for (int i = 0; i < 105; i++)
        {
            db.UserNotifications.Add(new UserNotification 
            { 
                Id = Guid.NewGuid(), 
                UserId = userId, 
                Type = "TEST", 
                Title = "T", 
                Body = "B", 
                CreatedAt = DateTime.UtcNow.AddSeconds(-i) 
            });
        }
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        // Passed 200, clamped to 100
        var result = await controller.GetMine(take: 200, before: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.True(dto.HasMore);
        Assert.Equal(100, dto.Items.Count);
    }

    [Fact]
    public async Task GetMine_ShouldIgnoreBefore_WhenBeforeIsInvalidFormat()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var n1 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow };
        db.UserNotifications.Add(n1);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 10, before: "invalid-date");

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Single(dto.Items);
        Assert.Equal(n1.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldFilterByBeforeUtc_WhenBeforeIsValidText()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var baseTime = new DateTime(2025, 1, 10, 15, 0, 0, DateTimeKind.Utc);
        
        var older = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "older", Body = "1", CreatedAt = baseTime.AddMinutes(-10) };
        var newer = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "newer", Body = "2", CreatedAt = baseTime.AddMinutes(10) };
        db.UserNotifications.AddRange(older, newer);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        // Pass baseTime as before string
        var beforeStr = baseTime.ToString("o", CultureInfo.InvariantCulture);
        var result = await controller.GetMine(take: 10, before: beforeStr);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Single(dto.Items);
        Assert.Equal(older.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldConvertUnspecifiedDateToUtc_WhenBeforeIsUnspecifiedKind()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var baseTime = new DateTime(2025, 1, 10, 15, 0, 0, DateTimeKind.Utc);
        
        var older = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "older", Body = "1", CreatedAt = baseTime.AddMinutes(-5) };
        var newer = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "newer", Body = "2", CreatedAt = baseTime.AddMinutes(5) };
        db.UserNotifications.AddRange(older, newer);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        // String without "Z" or offset is parsed as Unspecified if not using specific culture that enforces it,
        // but let's write it out explicitly as yyyy-MM-ddTHH:mm:ss
        var beforeStr = baseTime.ToString("yyyy-MM-ddTHH:mm:ss");
        
        var result = await controller.GetMine(take: 10, before: beforeStr);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Single(dto.Items);
        Assert.Equal(older.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldExcludeDeletedNotifications()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var active = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow };
        var deleted = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "2", Body = "2", CreatedAt = DateTime.UtcNow, IsDeleted = true };
        db.UserNotifications.AddRange(active, deleted);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Single(dto.Items);
        Assert.Equal(active.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldExcludeOtherUsersNotifications()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        
        var mine = new UserNotification { Id = Guid.NewGuid(), UserId = myUserId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow };
        var theirs = new UserNotification { Id = Guid.NewGuid(), UserId = otherUserId, Type = "TEST", Title = "2", Body = "2", CreatedAt = DateTime.UtcNow };
        db.UserNotifications.AddRange(mine, theirs);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, myUserId);

        var result = await controller.GetMine(take: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Single(dto.Items);
        Assert.Equal(mine.Id, dto.Items[0].Id);
    }

    [Fact]
    public async Task GetMine_ShouldOrderByCreatedAtDescThenIdDesc()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var time = DateTime.UtcNow;
        
        var n1 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "T", Title = "1", Body = "1", CreatedAt = time.AddMinutes(-5) };
        var n2 = new UserNotification { Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), UserId = userId, Type = "T", Title = "2", Body = "2", CreatedAt = time };
        var n3 = new UserNotification { Id = Guid.Parse("00000000-0000-0000-0000-000000000002"), UserId = userId, Type = "T", Title = "3", Body = "3", CreatedAt = time };
        db.UserNotifications.AddRange(n1, n2, n3);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Equal(3, dto.Items.Count);
        Assert.Equal(n3.Id, dto.Items[0].Id); // Same time, Id=...2 comes before Id=...1 descending
        Assert.Equal(n2.Id, dto.Items[1].Id);
        Assert.Equal(n1.Id, dto.Items[2].Id); // Older time is last
    }

    [Fact]
    public async Task GetMine_ShouldReturnHasMoreFalse_WhenItemsCountIsLessThanTake()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        db.UserNotifications.Add(new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 2);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.False(dto.HasMore);
        Assert.NotNull(dto.NextBefore); // Still has NextBefore since elements > 0
    }

    [Fact]
    public async Task GetMine_ShouldReturnHasMoreFalse_WhenItemsCountEqualsTake()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var n1 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow };
        var n2 = new UserNotification { Id = Guid.NewGuid(), UserId = userId, Type = "TEST", Title = "1", Body = "1", CreatedAt = DateTime.UtcNow.AddMinutes(-1) };
        db.UserNotifications.AddRange(n1, n2);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMine(take: 2);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.False(dto.HasMore);
        Assert.Equal(2, dto.Items.Count);
    }

    [Fact]
    public async Task GetMine_ShouldReturnNextBeforeNull_WhenNoItemsRetrieved()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // New user, empty DB

        var result = await controller.GetMine(take: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Empty(dto.Items);
        Assert.False(dto.HasMore);
        Assert.Null(dto.NextBefore);
    }
}

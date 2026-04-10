using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Notification;

public class NotificationsControllerGetUnreadCountTests
{
    private static int ReadCountFromPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("count").GetInt32();
    }

    [Fact]
    public async Task GetUnreadCount_ShouldReturnUnauthorized_WhenUserClaimMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.GetUnreadCount();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetUnreadCount_ShouldReturnUnauthorized_WhenUserClaimInvalidGuid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db);
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

        var result = await controller.GetUnreadCount();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetUnreadCount_ShouldUseSubClaimFallback_WhenNameIdentifierMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "BOOKING",
            Title = "n1",
            Body = "b1",
            IsRead = false,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
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

        var result = await controller.GetUnreadCount();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, ReadCountFromPayload(ok.Value));
    }

    [Fact]
    public async Task GetUnreadCount_ShouldCountOnlyUnreadAndNotDeleted_ForCurrentUser()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        db.UserNotifications.AddRange(
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "unread-1",
                Body = "b",
                IsRead = false,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "unread-2",
                Body = "b",
                IsRead = false,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "read",
                Body = "b",
                IsRead = true,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "deleted",
                Body = "b",
                IsRead = false,
                IsDeleted = true,
                CreatedAt = DateTime.UtcNow
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = otherUserId,
                Type = "BOOKING",
                Title = "other-user",
                Body = "b",
                IsRead = false,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            }
        );
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetUnreadCount();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, ReadCountFromPayload(ok.Value));
    }

    [Fact]
    public async Task GetUnreadCount_ShouldReturnZero_WhenNoUnreadNotifications()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.UserNotifications.AddRange(
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "read",
                Body = "b",
                IsRead = true,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            },
            new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = "BOOKING",
                Title = "deleted",
                Body = "b",
                IsRead = false,
                IsDeleted = true,
                CreatedAt = DateTime.UtcNow
            }
        );
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetUnreadCount();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, ReadCountFromPayload(ok.Value));
    }

    [Fact]
    public async Task GetUnreadCount_ShouldBeSideEffectFree_WhenCalledRepeatedly()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "BOOKING",
            Title = "unread",
            Body = "b",
            IsRead = false,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var first = await controller.GetUnreadCount();
        var second = await controller.GetUnreadCount();

        var okFirst = Assert.IsType<OkObjectResult>(first);
        var okSecond = Assert.IsType<OkObjectResult>(second);
        Assert.Equal(1, ReadCountFromPayload(okFirst.Value));
        Assert.Equal(1, ReadCountFromPayload(okSecond.Value));
        Assert.Equal(1, db.UserNotifications.Count());
        Assert.False(db.UserNotifications.Single().IsRead);
        Assert.False(db.UserNotifications.Single().IsDeleted);
    }
}


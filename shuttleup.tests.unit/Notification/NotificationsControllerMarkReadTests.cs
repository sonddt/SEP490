using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Notification;

public class NotificationsControllerMarkReadTests
{
    private class MarkReadResponse
    {
        public Guid Id { get; set; }
        public bool IsRead { get; set; }
    }

    private static MarkReadResponse ReadResponseFromPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<MarkReadResponse>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    [Fact]
    public async Task MarkRead_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.MarkRead(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task MarkRead_ShouldReturnNotFound_WhenNotificationDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.MarkRead(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task MarkRead_ShouldReturnNotFound_WhenNotificationBelongsToAnotherUser()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var myUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = notificationId,
            UserId = otherUserId,
            Type = "TEST",
            Title = "test",
            Body = "body",
            IsRead = false,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, myUserId);

        var result = await controller.MarkRead(notificationId);

        Assert.IsType<NotFoundResult>(result);
        
        // Ensure state wasn't changed in DB
        var dbNote = db.UserNotifications.Single();
        Assert.False(dbNote.IsRead);
    }

    [Fact]
    public async Task MarkRead_ShouldReturnNotFound_WhenNotificationIsDeleted()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = notificationId,
            UserId = userId,
            Type = "TEST",
            Title = "test",
            Body = "body",
            IsRead = false,
            IsDeleted = true, // Deleted
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.MarkRead(notificationId);

        Assert.IsType<NotFoundResult>(result);
        
        // Ensure state wasn't changed in DB
        var dbNote = db.UserNotifications.Single();
        Assert.False(dbNote.IsRead);
    }

    [Fact]
    public async Task MarkRead_ShouldMarkAsReadAndReturnOk_WhenNotificationIsUnread()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = notificationId,
            UserId = userId,
            Type = "TEST",
            Title = "test",
            Body = "body",
            IsRead = false,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.MarkRead(notificationId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Equal(notificationId, dto.Id);
        Assert.True(dto.IsRead);

        // Verify side effect in DB
        var dbNote = db.UserNotifications.Single();
        Assert.True(dbNote.IsRead);
    }

    [Fact]
    public async Task MarkRead_ShouldRemainReadAndReturnOk_WhenNotificationIsAlreadyRead()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        db.UserNotifications.Add(new UserNotification
        {
            Id = notificationId,
            UserId = userId,
            Type = "TEST",
            Title = "test",
            Body = "body",
            IsRead = true, // Already read
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.MarkRead(notificationId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Equal(notificationId, dto.Id);
        Assert.True(dto.IsRead);

        // Verify state remains read
        var dbNote = db.UserNotifications.Single();
        Assert.True(dbNote.IsRead);
    }
}

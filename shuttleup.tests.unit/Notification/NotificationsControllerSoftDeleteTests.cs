using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Notification;

public class NotificationsControllerSoftDeleteTests
{
    private class SoftDeleteResponse
    {
        public Guid Id { get; set; }
        public bool Deleted { get; set; }
    }

    private static SoftDeleteResponse ReadResponseFromPayload(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<SoftDeleteResponse>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    [Fact]
    public async Task SoftDelete_ShouldReturnUnauthorized_WhenUserNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = new NotificationsController(db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.SoftDelete(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task SoftDelete_ShouldReturnNotFound_WhenNotificationDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.SoftDelete(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task SoftDelete_ShouldReturnNotFound_WhenNotificationBelongsToAnotherUser()
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

        var result = await controller.SoftDelete(notificationId);

        Assert.IsType<NotFoundResult>(result);
        
        // Ensure state wasn't changed in DB
        var dbNote = db.UserNotifications.Single();
        Assert.False(dbNote.IsDeleted);
    }

    [Fact]
    public async Task SoftDelete_ShouldReturnNotFound_WhenNotificationIsAlreadyDeleted()
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
            IsDeleted = true, // Already Deleted
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        ControllerTestHelper.SetUser(controller, userId);

        // Attempting to delete an already deleted notification should yield NotFound naturally
        var result = await controller.SoftDelete(notificationId);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task SoftDelete_ShouldMarkAsDeletedAndReturnOk_WhenNotificationIsActive()
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

        var result = await controller.SoftDelete(notificationId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = ReadResponseFromPayload(ok.Value);

        Assert.Equal(notificationId, dto.Id);
        Assert.True(dto.Deleted);

        // Verify side effect in DB
        var dbNote = db.UserNotifications.Single();
        Assert.True(dbNote.IsDeleted);
    }
}

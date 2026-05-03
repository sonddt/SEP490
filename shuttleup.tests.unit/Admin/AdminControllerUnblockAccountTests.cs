using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Admin;

public class AdminControllerUnblockAccountTests
{
    private AdminController CreateController(ShuttleUpDbContext db, IUserService? userService = null)
    {
        var mockUser    = userService != null ? Mock.Get(userService) : new Mock<IUserService>();
        var mockVenue   = new Mock<IVenueService>();
        var mockBooking = new Mock<IBookingService>();

        var controller = new AdminController(mockUser.Object, mockVenue.Object, mockBooking.Object, db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                    new Claim(ClaimTypes.Role, "ADMIN")
                }, "mock"))
            }
        };
        return controller;
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    private class MessageResponse { public string Message { get; set; } = ""; }
    private class UnblockOkResponse { public string Message { get; set; } = ""; public Guid UserId { get; set; } }

    // ══════════════════════════════════════════════════════════════════
    // 1. NOT FOUND — IUserService returns null
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldReturnNotFound_WhenUserDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync((User?)null);

        var controller = CreateController(db, userService: mockUser.Object);

        var result = await controller.UnblockAccount(targetId);
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<MessageResponse>(notFound.Value).Message.ToLowerInvariant());

        // UnblockUserAsync must never fire for a ghost user
        mockUser.Verify(s => s.UnblockUserAsync(It.IsAny<Guid>()), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. ALREADY ACTIVE — idempotency guard (IsActive == true)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldReturnBadRequest_WhenUserIsAlreadyActive()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var activeUser = new User { Id = targetId, FullName = "Active User", Email = "a@x.com", IsActive = true };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(activeUser);

        var controller = CreateController(db, userService: mockUser.Object);

        var result = await controller.UnblockAccount(targetId);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("đang hoạt động bình thường", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());

        // UnblockUserAsync must NOT be called when already active
        mockUser.Verify(s => s.UnblockUserAsync(It.IsAny<Guid>()), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. HAPPY PATH — blocked user successfully unblocked
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldCallUnblockUserAsync_AndReturnOk_WhenUserIsBlocked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var blockedUser = new User { Id = targetId, FullName = "Blocked User", Email = "b@x.com", IsActive = false };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(blockedUser);
        mockUser.Setup(s => s.UnblockUserAsync(targetId)).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object);

        var result = await controller.UnblockAccount(targetId);
        var ok = Assert.IsType<OkObjectResult>(result);

        // Service must be called exactly once with the right ID
        mockUser.Verify(s => s.UnblockUserAsync(targetId), Times.Once);

        // Response shape
        var response = ReadPayload<UnblockOkResponse>(ok.Value);
        Assert.Contains("mở khoá", response.Message.ToLowerInvariant());
        Assert.Equal(targetId, response.UserId);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. CORRECT TARGET ID — service receives the route param, not any other
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldForwardCorrectUserId_ToUnblockUserAsync()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var wrongId  = Guid.NewGuid();
        var user = new User { Id = targetId, IsActive = false };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(user);
        mockUser.Setup(s => s.UnblockUserAsync(It.IsAny<Guid>())).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object);
        await controller.UnblockAccount(targetId);

        mockUser.Verify(s => s.UnblockUserAsync(targetId), Times.Once);
        mockUser.Verify(s => s.UnblockUserAsync(wrongId),  Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. NO SELF-BLOCK CHECK — UnblockAccount has NO self-restriction
    //    (unlike BlockAccount; admin CAN unblock themselves if locked)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldSucceed_EvenWhenTargetIsTheSameAsCallingAdmin()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        // Simulate a scenario where the admin's own account somehow got blocked
        var adminId = Guid.NewGuid();
        var selfBlocked = new User { Id = adminId, FullName = "Self Admin", IsActive = false };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(adminId)).ReturnsAsync(selfBlocked);
        mockUser.Setup(s => s.UnblockUserAsync(adminId)).Returns(Task.CompletedTask);

        // Create controller with adminId claim matching the target
        var mockVenue   = new Mock<IVenueService>();
        var mockBooking = new Mock<IBookingService>();
        var controller = new AdminController(mockUser.Object, mockVenue.Object, mockBooking.Object, db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, adminId.ToString()),
                    new Claim(ClaimTypes.Role, "ADMIN")
                }, "mock"))
            }
        };

        // Unlike BlockAccount, there is NO self-restriction in UnblockAccount
        var result = await controller.UnblockAccount(adminId);
        Assert.IsType<OkObjectResult>(result);
        mockUser.Verify(s => s.UnblockUserAsync(adminId), Times.Once);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. REPEATED CALL — second unblock attempt on already-active user is rejected
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task UnblockAccount_ShouldReturnBadRequest_OnSecondCallAfterSuccessfulUnblock()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();

        // Simulate state change: first call sees IsActive=false, second sees IsActive=true
        var blockedUser = new User { Id = targetId, IsActive = false };
        var activeUser  = new User { Id = targetId, IsActive = true  };

        var callCount = 0;
        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(() => callCount++ == 0 ? blockedUser : activeUser);
        mockUser.Setup(s => s.UnblockUserAsync(targetId)).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object);

        // First call — succeeds
        var first = await controller.UnblockAccount(targetId);
        Assert.IsType<OkObjectResult>(first);

        // Second call — user now active, should be rejected
        var second = await controller.UnblockAccount(targetId);
        Assert.IsType<BadRequestObjectResult>(second);

        // UnblockUserAsync called exactly once (for the first call only)
        mockUser.Verify(s => s.UnblockUserAsync(targetId), Times.Once);
    }
}

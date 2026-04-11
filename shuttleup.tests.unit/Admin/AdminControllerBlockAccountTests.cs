using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.AdminController;

namespace shuttleup.tests.unit.Admin;

public class AdminControllerBlockAccountTests
{
    private AdminController CreateController(
        ShuttleUpDbContext db,
        IUserService? userService = null,
        Guid? adminId = null)
    {
        var mockUser    = userService != null ? Mock.Get(userService) : new Mock<IUserService>();
        var mockVenue   = new Mock<IVenueService>();
        var mockBooking = new Mock<IBookingService>();

        var controller = new AdminController(mockUser.Object, mockVenue.Object, mockBooking.Object, db);

        // GetCurrentUserId() reads JwtRegisteredClaimNames.Sub OR ClaimTypes.NameIdentifier
        var claims = adminId.HasValue && adminId.Value != Guid.Empty
            ? new Claim[] { new Claim(ClaimTypes.NameIdentifier, adminId.Value.ToString()), new Claim(ClaimTypes.Role, "ADMIN") }
            : Array.Empty<Claim>(); // no valid claim → GetCurrentUserId() returns Guid.Empty

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "mock"))
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
    private class BlockOkResponse { public string Message { get; set; } = ""; public Guid UserId { get; set; } }

    // ══════════════════════════════════════════════════════════════════
    // 1. UNAUTHENTICATED — no valid sub claim → GetCurrentUserId returns Guid.Empty
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldReturnUnauthorized_WhenAdminClaimMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, adminId: null); // no claim

        var result = await controller.BlockAccount(Guid.NewGuid(), new BlockAccountRequest(null));
        var unauth = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Contains("admin", ReadPayload<MessageResponse>(unauth.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. NOT FOUND — IUserService returns null
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldReturnNotFound_WhenUserDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync((User?)null);

        var controller = CreateController(db, userService: mockUser.Object, adminId: Guid.NewGuid());

        var result = await controller.BlockAccount(targetId, new BlockAccountRequest(null));
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<MessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. ALREADY BLOCKED — idempotent guard (IsActive == false)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldReturnBadRequest_WhenUserIsAlreadyBlocked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var targetId = Guid.NewGuid();
        var alreadyBlocked = new User { Id = targetId, FullName = "Blocked", Email = "b@x.com", IsActive = false };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(alreadyBlocked);

        var controller = CreateController(db, userService: mockUser.Object, adminId: Guid.NewGuid());

        var result = await controller.BlockAccount(targetId, new BlockAccountRequest(null));
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("đã bị khoá", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());

        // BlockUserAsync must NOT be called on an already-blocked account
        mockUser.Verify(s => s.BlockUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. SELF-BLOCK PREVENTION — admin cannot block their own account
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldReturnBadRequest_WhenAdminTriesToBlockThemselves()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId = Guid.NewGuid();
        var selfUser = new User { Id = adminId, FullName = "Self Admin", Email = "admin@x.com", IsActive = true };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(adminId)).ReturnsAsync(selfUser);

        var controller = CreateController(db, userService: mockUser.Object, adminId: adminId);

        var result = await controller.BlockAccount(adminId, new BlockAccountRequest("Testing self-lock"));
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chính mình", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());

        mockUser.Verify(s => s.BlockUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. HAPPY PATH — null reason falls back to default message
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldDelegateWithDefaultReason_WhenNoReasonProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId  = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var target   = new User { Id = targetId, FullName = "Violator", Email = "v@x.com", IsActive = true };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(target);
        mockUser.Setup(s => s.BlockUserAsync(targetId, adminId, It.IsAny<string>())).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object, adminId: adminId);

        var result = await controller.BlockAccount(targetId, new BlockAccountRequest(null));
        var ok = Assert.IsType<OkObjectResult>(result);

        // Verify fallback default reason is used
        mockUser.Verify(s => s.BlockUserAsync(targetId, adminId, "Vi phạm điều khoản."), Times.Once);

        // Verify response shape
        var response = ReadPayload<BlockOkResponse>(ok.Value);
        Assert.Contains("khoá", response.Message.ToLowerInvariant());
        Assert.Equal(targetId, response.UserId);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. HAPPY PATH — custom reason passes through verbatim
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldPassCustomReason_WhenReasonIsProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId  = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var target   = new User { Id = targetId, FullName = "Cheater", Email = "cheat@x.com", IsActive = true };
        const string customReason = "Sử dụng bot đặt sân hàng loạt.";

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(target);
        mockUser.Setup(s => s.BlockUserAsync(targetId, adminId, customReason)).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object, adminId: adminId);

        var result = await controller.BlockAccount(targetId, new BlockAccountRequest(customReason));
        Assert.IsType<OkObjectResult>(result);

        // Custom reason must be forwarded exactly — not replaced by default
        mockUser.Verify(s => s.BlockUserAsync(targetId, adminId, customReason), Times.Once);
        mockUser.Verify(s => s.BlockUserAsync(targetId, adminId, "Vi phạm điều khoản."), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. CORRECT ADMIN ID FORWARDED — service receives the caller's identity
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BlockAccount_ShouldForwardAdminId_ToBlockUserAsync()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId   = Guid.NewGuid();
        var targetId  = Guid.NewGuid();
        var wrongId   = Guid.NewGuid(); // Ensure this is never passed
        var target    = new User { Id = targetId, FullName = "Target", Email = "t@x.com", IsActive = true };

        var mockUser = new Mock<IUserService>();
        mockUser.Setup(s => s.GetByIdAsync(targetId)).ReturnsAsync(target);
        mockUser.Setup(s => s.BlockUserAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>())).Returns(Task.CompletedTask);

        var controller = CreateController(db, userService: mockUser.Object, adminId: adminId);
        await controller.BlockAccount(targetId, new BlockAccountRequest(null));

        // Audit trail: adminId must be the one from the JWT, not a random ID
        mockUser.Verify(s => s.BlockUserAsync(targetId, adminId, It.IsAny<string>()), Times.Once);
        mockUser.Verify(s => s.BlockUserAsync(targetId, wrongId, It.IsAny<string>()), Times.Never);
    }
}

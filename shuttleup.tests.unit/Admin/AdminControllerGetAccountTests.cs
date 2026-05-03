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

public class AdminControllerGetAccountTests
{
    private AdminController CreateController(ShuttleUpDbContext db)
    {
        var mockUser    = new Mock<IUserService>();
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

    private class AccountDetailResponse
    {
        public Guid Id { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Gender { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? BlockedAt { get; set; }
        public string? BlockedReason { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<string>? Roles { get; set; }
    }

    private class ErrorResponse { public string Message { get; set; } = ""; }

    // ══════════════════════════════════════════════════════════════════
    // 1. NOT FOUND — unknown userId returns 404
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnNotFound_WhenUserDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);

        var result = await controller.GetAccount(Guid.NewGuid());
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. HAPPY PATH — all scalar fields projected correctly
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnAllScalarFields_WhenUserExists()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var dob = new DateTime(1995, 8, 20, 0, 0, 0, DateTimeKind.Utc);
        var created = new DateTime(2024, 1, 10, 9, 0, 0, DateTimeKind.Utc);
        var updated = new DateTime(2024, 3, 5, 14, 30, 0, DateTimeKind.Utc);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Nguyen Van Huy",
            Email = "huy@shuttleup.vn",
            PhoneNumber = "0901234567",
            Gender = "MALE",
            DateOfBirth = dob,
            IsActive = true,
            BlockedAt = null,
            BlockedReason = null,
            CreatedAt = created,
            UpdatedAt = updated
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccount(user.Id));
        var detail = ReadPayload<AccountDetailResponse>(ok.Value);

        Assert.Equal(user.Id, detail.Id);
        Assert.Equal("Nguyen Van Huy", detail.FullName);
        Assert.Equal("huy@shuttleup.vn", detail.Email);
        Assert.Equal("0901234567", detail.PhoneNumber);
        Assert.Equal("MALE", detail.Gender);
        Assert.Equal(dob, detail.DateOfBirth?.ToUniversalTime());
        Assert.True(detail.IsActive);
        Assert.Null(detail.BlockedAt);
        Assert.Null(detail.BlockedReason);
        Assert.Equal(created, detail.CreatedAt?.ToUniversalTime());
        Assert.Equal(updated, detail.UpdatedAt?.ToUniversalTime());
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. ROLES — projected as name-string list
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnEmptyRolesList_WhenUserHasNoRoles()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var user = new User { Id = Guid.NewGuid(), FullName = "No Role User", Email = "norole@x.com" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccount(user.Id));
        var detail = ReadPayload<AccountDetailResponse>(ok.Value);

        Assert.NotNull(detail.Roles);
        Assert.Empty(detail.Roles!);
    }

    [Fact]
    public async Task GetAccount_ShouldReturnAllRoleNames_WhenUserHasMultipleRoles()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var roleManager = new Role { Id = Guid.NewGuid(), Name = "MANAGER" };
        var rolePlayer  = new Role { Id = Guid.NewGuid(), Name = "PLAYER" };
        db.Roles.AddRange(roleManager, rolePlayer);

        var user = new User { Id = Guid.NewGuid(), FullName = "Dual Role", Email = "dual@x.com" };
        user.Roles.Add(roleManager);
        user.Roles.Add(rolePlayer);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccount(user.Id));
        var detail = ReadPayload<AccountDetailResponse>(ok.Value);

        Assert.Equal(2, detail.Roles!.Count);
        Assert.Contains("MANAGER", detail.Roles);
        Assert.Contains("PLAYER", detail.Roles);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. BLOCKED ACCOUNT — IsActive=false, BlockedAt/Reason still returned
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnBlockedFields_WhenUserIsBlocked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var blockedAt = new DateTime(2025, 2, 14, 8, 0, 0, DateTimeKind.Utc);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Blocked User",
            Email = "blocked@x.com",
            IsActive = false,
            BlockedAt = blockedAt,
            BlockedReason = "Vi phạm điều khoản lần 3."
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccount(user.Id));
        var detail = ReadPayload<AccountDetailResponse>(ok.Value);

        // Blocked user is NOT hidden — admin must see the full record
        Assert.Equal(user.Id, detail.Id);
        Assert.False(detail.IsActive);
        Assert.Equal(blockedAt, detail.BlockedAt?.ToUniversalTime());
        Assert.Equal("Vi phạm điều khoản lần 3.", detail.BlockedReason);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. ID ISOLATION — different IDs never cross-contaminate
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnCorrectUser_WhenMultipleUsersExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var userA = new User { Id = Guid.NewGuid(), FullName = "Alice", Email = "a@x.com" };
        var userB = new User { Id = Guid.NewGuid(), FullName = "Bob",   Email = "b@x.com" };
        db.Users.AddRange(userA, userB);
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        var okA = Assert.IsType<OkObjectResult>(await controller.GetAccount(userA.Id));
        var okB = Assert.IsType<OkObjectResult>(await controller.GetAccount(userB.Id));

        Assert.Equal("Alice", ReadPayload<AccountDetailResponse>(okA.Value).FullName);
        Assert.Equal("Bob",   ReadPayload<AccountDetailResponse>(okB.Value).FullName);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. IDEMPOTENT — repeated reads do not mutate state
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldBeIdempotent_WhenCalledMultipleTimes()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var user = new User { Id = Guid.NewGuid(), FullName = "Stable User", Email = "stable@x.com", IsActive = true };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var countBefore = db.Users.Count();

        await controller.GetAccount(user.Id);
        await controller.GetAccount(user.Id);
        await controller.GetAccount(user.Id);

        // No new records created, no field mutations
        Assert.Equal(countBefore, db.Users.Count());
        Assert.Equal("Stable User", db.Users.Find(user.Id)!.FullName);
        Assert.True(db.Users.Find(user.Id)!.IsActive);
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. NULL OPTIONAL FIELDS — Gender, DateOfBirth, Phone etc. may be null
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccount_ShouldReturnNullForOptionalFields_WhenNotProvided()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Minimal User",
            Email = "min@x.com",
            PhoneNumber = null,
            Gender = null,
            DateOfBirth = null,
            UpdatedAt = null
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccount(user.Id));
        var detail = ReadPayload<AccountDetailResponse>(ok.Value);

        Assert.Null(detail.PhoneNumber);
        Assert.Null(detail.Gender);
        Assert.Null(detail.DateOfBirth);
        Assert.Null(detail.UpdatedAt);
    }
}

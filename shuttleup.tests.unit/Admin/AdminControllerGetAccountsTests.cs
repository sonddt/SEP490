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

public class AdminControllerGetAccountsTests
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

    // ── Seed helpers ──────────────────────────────────────────────────────────

    private static Role MakeRole(string name) => new Role { Id = Guid.NewGuid(), Name = name };

    private static User MakeUser(string fullName, string email, bool isActive = true,
        DateTime? createdAt = null, params Role[] roles)
    {
        var u = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Email = email,
            IsActive = isActive,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        foreach (var r in roles) u.Roles.Add(r);
        return u;
    }

    // ══════════════════════════════════════════════════════════════════
    // 1. EMPTY DATABASE — returns Ok with empty list and zero counts
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldReturnEmptyPage_WhenNoDatabaseUsers()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);

        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccounts(null, null, null));
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(0, payload.GetProperty("totalItems").GetInt32());
        Assert.Equal(0, payload.GetProperty("totalPages").GetInt32());
        Assert.Equal(0, payload.GetProperty("items").GetArrayLength());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. PAGINATION — invalid page/pageSize clamped to defaults
    // ══════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData(0,   20, 1,  20)]  // page <= 0 → 1
    [InlineData(-5,  50, 1,  50)]  // page negative → 1
    [InlineData(1,   0,  1,  20)]  // pageSize <= 0 → 20
    [InlineData(1,  101, 1,  20)]  // pageSize > 100 → 20
    [InlineData(1,  100, 1, 100)]  // pageSize == 100 is valid
    public async Task GetAccounts_ShouldClampInvalidPaginationParameters(
        int inputPage, int inputPageSize, int expectedPage, int expectedPageSize)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        db.Users.Add(MakeUser("Test", "t@x.com"));
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(
            await controller.GetAccounts(null, null, null, inputPage, inputPageSize));
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(expectedPage, payload.GetProperty("page").GetInt32());
        Assert.Equal(expectedPageSize, payload.GetProperty("pageSize").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. SEARCH — matches FullName and Email, case-insensitive
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldFilterBySearchKeyword_MatchingNameOrEmail()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        db.Users.AddRange(
            MakeUser("Nguyen Van Huy", "huy@abc.com"),
            MakeUser("Tran Thi Lan",   "lan@abc.com"),
            MakeUser("Le Van Nam",      "nam@xyz.com")
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        // Search by partial name
        var r1 = Assert.IsType<OkObjectResult>(await controller.GetAccounts(search: "Huy"));
        Assert.Equal(1, ReadPayload<JsonElement>(r1.Value).GetProperty("totalItems").GetInt32());

        // Search by partial email domain
        var r2 = Assert.IsType<OkObjectResult>(await controller.GetAccounts(search: "abc.com"));
        Assert.Equal(2, ReadPayload<JsonElement>(r2.Value).GetProperty("totalItems").GetInt32());

        // Search with no match
        var r3 = Assert.IsType<OkObjectResult>(await controller.GetAccounts(search: "ZZZNOMATCH"));
        Assert.Equal(0, ReadPayload<JsonElement>(r3.Value).GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task GetAccounts_ShouldTrimSearchKeyword_BeforeFiltering()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        db.Users.Add(MakeUser("Phan Minh Duc", "duc@test.com"));
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccounts(search: "   Duc   "));
        Assert.Equal(1, ReadPayload<JsonElement>(ok.Value).GetProperty("totalItems").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. ROLE FILTER — case-insensitive (code uppercases it)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldFilterByRole_NormalizingToUppercase()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var managerRole = MakeRole("MANAGER");
        var playerRole  = MakeRole("PLAYER");
        db.Roles.AddRange(managerRole, playerRole);

        db.Users.AddRange(
            MakeUser("Manager One", "m1@x.com", roles: managerRole),
            MakeUser("Manager Two", "m2@x.com", roles: managerRole),
            MakeUser("Player One",  "p1@x.com", roles: playerRole)
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        // Lowercase input — backend uppercases it
        var rManager = Assert.IsType<OkObjectResult>(await controller.GetAccounts(role: "manager"));
        Assert.Equal(2, ReadPayload<JsonElement>(rManager.Value).GetProperty("totalItems").GetInt32());

        var rPlayer = Assert.IsType<OkObjectResult>(await controller.GetAccounts(role: "PLAYER"));
        Assert.Equal(1, ReadPayload<JsonElement>(rPlayer.Value).GetProperty("totalItems").GetInt32());

        // Non-existent role → 0 results, not an error
        var rAdmin = Assert.IsType<OkObjectResult>(await controller.GetAccounts(role: "ADMIN"));
        Assert.Equal(0, ReadPayload<JsonElement>(rAdmin.Value).GetProperty("totalItems").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. STATUS FILTER — "active" / "blocked" / anything else
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldFilterByStatus_ActiveVsBlocked()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        db.Users.AddRange(
            MakeUser("Active A", "a@x.com", isActive: true),
            MakeUser("Active B", "b@x.com", isActive: true),
            MakeUser("Blocked C", "c@x.com", isActive: false)
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        var rActive = Assert.IsType<OkObjectResult>(await controller.GetAccounts(status: "active"));
        Assert.Equal(2, ReadPayload<JsonElement>(rActive.Value).GetProperty("totalItems").GetInt32());

        // "blocked" (anything that isn't "active") → isActive == false
        var rBlocked = Assert.IsType<OkObjectResult>(await controller.GetAccounts(status: "blocked"));
        Assert.Equal(1, ReadPayload<JsonElement>(rBlocked.Value).GetProperty("totalItems").GetInt32());

        // null status → no filter → all 3
        var rAll = Assert.IsType<OkObjectResult>(await controller.GetAccounts(status: null));
        Assert.Equal(3, ReadPayload<JsonElement>(rAll.Value).GetProperty("totalItems").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. COMBINED FILTERS — search + role + status together
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldApplyAllFiltersSimultaneously()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        var managerRole = MakeRole("MANAGER");
        db.Roles.Add(managerRole);

        db.Users.AddRange(
            MakeUser("Huy Manager",  "huy@x.com", isActive: true,  roles: managerRole),
            MakeUser("Huy Blocked",  "huy2@x.com", isActive: false, roles: managerRole),
            MakeUser("Lan Manager",  "lan@x.com",  isActive: true,  roles: managerRole)
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        // "huy" + MANAGER + active → only "Huy Manager"
        var ok = Assert.IsType<OkObjectResult>(
            await controller.GetAccounts(search: "huy", role: "MANAGER", status: "active"));
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(1, payload.GetProperty("totalItems").GetInt32());
        Assert.Equal("Huy Manager", payload.GetProperty("items")[0].GetProperty("fullName").GetString());
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. ORDERING — newest CreatedAt first
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldReturnItemsOrderedByCreatedAtDescending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var now = DateTime.UtcNow;

        db.Users.AddRange(
            MakeUser("Old User",  "old@x.com", createdAt: now.AddDays(-10)),
            MakeUser("New User",  "new@x.com", createdAt: now.AddDays(-1)),
            MakeUser("Mid User",  "mid@x.com", createdAt: now.AddDays(-5))
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccounts());
        var items = ReadPayload<JsonElement>(ok.Value).GetProperty("items");

        Assert.Equal("New User", items[0].GetProperty("fullName").GetString());
        Assert.Equal("Mid User", items[1].GetProperty("fullName").GetString());
        Assert.Equal("Old User", items[2].GetProperty("fullName").GetString());
    }

    // ══════════════════════════════════════════════════════════════════
    // 8. PAGINATION SKIP/TAKE — page 2 returns correct slice
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldSkipCorrectItemsOnPage2()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var now = DateTime.UtcNow;

        // 5 users, ordered newest → oldest: U0..U4
        for (int i = 0; i < 5; i++)
        {
            db.Users.Add(MakeUser($"User {i}", $"u{i}@x.com", createdAt: now.AddHours(-i)));
        }
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        // pageSize=2: page 1 has U0,U1; page 2 has U2,U3; page 3 has U4
        var ok2 = Assert.IsType<OkObjectResult>(await controller.GetAccounts(page: 2, pageSize: 2));
        var payload2 = ReadPayload<JsonElement>(ok2.Value);

        Assert.Equal(5, payload2.GetProperty("totalItems").GetInt32());
        Assert.Equal(3, payload2.GetProperty("totalPages").GetInt32()); // ceil(5/2)=3
        Assert.Equal(2, payload2.GetProperty("items").GetArrayLength());
        Assert.Equal("User 2", payload2.GetProperty("items")[0].GetProperty("fullName").GetString());
    }

    // ══════════════════════════════════════════════════════════════════
    // 9. RESPONSE SHAPE — required fields present in each item
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetAccounts_ShouldProjectAllRequiredFieldsInEachItem()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var role = MakeRole("PLAYER");
        db.Roles.Add(role);

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            FullName = "Projection Test",
            Email = "proj@x.com",
            PhoneNumber = "0901234567",
            IsActive = true,
            BlockedAt = null,
            BlockedReason = null,
            CreatedAt = DateTime.UtcNow,
            Roles = { role }
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetAccounts());
        var item = ReadPayload<JsonElement>(ok.Value).GetProperty("items")[0];

        // All contract fields must be present
        Assert.True(item.TryGetProperty("id", out _));
        Assert.True(item.TryGetProperty("fullName", out _));
        Assert.True(item.TryGetProperty("email", out _));
        Assert.True(item.TryGetProperty("phoneNumber", out _));
        Assert.True(item.TryGetProperty("isActive", out _));
        Assert.True(item.TryGetProperty("blockedAt", out _));
        Assert.True(item.TryGetProperty("blockedReason", out _));
        Assert.True(item.TryGetProperty("createdAt", out _));
        Assert.True(item.TryGetProperty("roles", out _));

        Assert.Equal(1, item.GetProperty("roles").GetArrayLength());
        Assert.Equal("PLAYER", item.GetProperty("roles")[0].GetString());
    }
}

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

public class AdminControllerGetDashboardStatsTests
{
    private AdminController CreateController(ShuttleUpDbContext db, Guid? adminId = null)
    {
        var mockUser    = new Mock<IUserService>();
        var mockVenue   = new Mock<IVenueService>();
        var mockBooking = new Mock<IBookingService>();

        var controller = new AdminController(mockUser.Object, mockVenue.Object, mockBooking.Object, db);

        var claims = adminId.HasValue
            ? new Claim[] { new Claim(ClaimTypes.NameIdentifier, adminId.Value.ToString()), new Claim(ClaimTypes.Role, "ADMIN") }
            : Array.Empty<Claim>();

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

    // ══════════════════════════════════════════════════════════════════
    // 1. EMPTY DATABASE — all zeros, no recent users / pending venues
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldReturnAllZerosAndEmptyLists_WhenDatabaseIsEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, adminId: Guid.NewGuid());

        var result = await controller.GetDashboardStats();
        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(0, payload.GetProperty("totalUsers").GetInt32());
        Assert.Equal(0, payload.GetProperty("activeVenues").GetInt32());
        Assert.Equal(0, payload.GetProperty("todayBookings").GetInt32());
        Assert.Equal(0, payload.GetProperty("pendingRequests").GetInt32());
        Assert.Equal(0, payload.GetProperty("recentUsers").GetArrayLength());
        Assert.Equal(0, payload.GetProperty("pendingVenues").GetArrayLength());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. TOTAL USERS — counts every user irrespective of role / status
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldCountAllUsers_RegardlessOfRoleOrStatus()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        db.Users.AddRange(
            new User { Id = Guid.NewGuid(), FullName = "Active Player",  Email = "p@x.com", IsActive = true },
            new User { Id = Guid.NewGuid(), FullName = "Blocked Manager", Email = "m@x.com", IsActive = false },
            new User { Id = Guid.NewGuid(), FullName = "Admin",           Email = "a@x.com", IsActive = true }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var result = await controller.GetDashboardStats();
        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(3, payload.GetProperty("totalUsers").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. ACTIVE VENUES — only IsActive == true counted
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldCountOnlyActiveVenues()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();

        db.Venues.AddRange(
            new Venue { Id = Guid.NewGuid(), Name = "Open Arena",   IsActive = true },
            new Venue { Id = Guid.NewGuid(), Name = "Closed Arena",  IsActive = false },
            new Venue { Id = Guid.NewGuid(), Name = "Open Arena 2", IsActive = true }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var ok = Assert.IsType<OkObjectResult>(await controller.GetDashboardStats());
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(2, payload.GetProperty("activeVenues").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. TODAY BOOKINGS — strict date boundary (today UTC only)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldCountOnlyTodayBookings_ExcludingYesterday()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var todayStart = DateTime.UtcNow.Date;

        db.Bookings.AddRange(
            new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), CreatedAt = todayStart.AddHours(9) },  // Today ✓
            new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), CreatedAt = todayStart.AddHours(23) }, // Today ✓
            new ShuttleUp.DAL.Models.Booking { Id = Guid.NewGuid(), CreatedAt = todayStart.AddDays(-1) }   // Yesterday ✗
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var ok = Assert.IsType<OkObjectResult>(await controller.GetDashboardStats());
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(2, payload.GetProperty("todayBookings").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. PENDING REQUESTS — only PENDING status counted / listed
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldCountOnlyPendingManagerRequests()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var applicant = new User { Id = Guid.NewGuid(), FullName = "Applicant", Email = "app@x.com" };
        db.Users.Add(applicant);

        db.ManagerProfileRequests.AddRange(
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = applicant.Id, Status = "PENDING",  RequestedAt = DateTime.UtcNow },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = applicant.Id, Status = "PENDING",  RequestedAt = DateTime.UtcNow },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = applicant.Id, Status = "APPROVED", RequestedAt = DateTime.UtcNow },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = applicant.Id, Status = "REJECTED", RequestedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var ok = Assert.IsType<OkObjectResult>(await controller.GetDashboardStats());
        var payload = ReadPayload<JsonElement>(ok.Value);

        Assert.Equal(2, payload.GetProperty("pendingRequests").GetInt32());
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. RECENT USERS — capped at 5, ordered newest-first
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldReturnTop5NewestUsers_WhenMoreExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var base_ = DateTime.UtcNow;

        for (int i = 0; i < 8; i++)
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                FullName = $"User {i}",
                Email = $"u{i}@x.com",
                CreatedAt = base_.AddHours(-i) // Newest = User 0, oldest = User 7
            });
        }
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var ok = Assert.IsType<OkObjectResult>(await controller.GetDashboardStats());
        var payload = ReadPayload<JsonElement>(ok.Value);

        var recentUsers = payload.GetProperty("recentUsers");
        Assert.Equal(5, recentUsers.GetArrayLength()); // Hard-cap = Take(5)

        // First entry must be the most recently created user
        var firstUser = recentUsers[0];
        Assert.Equal("User 0", firstUser.GetProperty("fullName").GetString());
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. PENDING VENUES LIST — capped at 5, ordered by RequestedAt desc
    //    TaxCode => "MST: <code>"; null TaxCode => "Cá nhân"
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetDashboardStats_ShouldProjectManagerRequestsCorrectly_IncludingTaxCodeLabel()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var base_ = DateTime.UtcNow;
        var owner = new User { Id = Guid.NewGuid(), FullName = "Nguyen Van A", Email = "nva@x.com" };
        db.Users.Add(owner);

        db.ManagerProfileRequests.AddRange(
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = owner.Id, Status = "PENDING", TaxCode = "MST123", RequestedAt = base_ },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = owner.Id, Status = "PENDING", TaxCode = null,     RequestedAt = base_.AddMinutes(-5) }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var ok = Assert.IsType<OkObjectResult>(await controller.GetDashboardStats());
        var payload = ReadPayload<JsonElement>(ok.Value);

        var pendingVenues = payload.GetProperty("pendingVenues");
        Assert.Equal(2, pendingVenues.GetArrayLength());

        // Newest first → TaxCode = "MST123" → label = "MST: MST123"
        Assert.Equal("MST: MST123", pendingVenues[0].GetProperty("name").GetString());

        // Older entry with null TaxCode → label = "Cá nhân"
        Assert.Equal("Cá nhân", pendingVenues[1].GetProperty("name").GetString());

        // Owner name is projected
        Assert.Equal("Nguyen Van A", pendingVenues[0].GetProperty("ownerName").GetString());
    }
}

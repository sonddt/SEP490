using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using DalFile = ShuttleUp.DAL.Models.File;

namespace shuttleup.tests.unit.Admin;

public class AdminControllerGetManagerRequestsTests
{
    private AdminController CreateController(ShuttleUpDbContext db)
    {
        var mockUser = new Mock<IUserService>();
        var mockVenue = new Mock<IVenueService>();
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

    private class ManagerRequestItem
    {
        public Guid Id { get; set; }
        public string? Status { get; set; }
        public string? RequestType { get; set; }
        public string? TaxCode { get; set; }
        public string? Address { get; set; }
        public string? CccdFrontUrl { get; set; }
        public string? CccdBackUrl { get; set; }
        public List<LicenseFile>? BusinessLicenseFiles { get; set; }
        public string? OwnerName { get; set; }
        public string? OwnerEmail { get; set; }
        public DateTime? RequestedAt { get; set; }
        public DateTime? DecisionAt { get; set; }
        public string? DecisionNote { get; set; }
        public string? AdminName { get; set; }
    }

    private class LicenseFile
    {
        public string? Url { get; set; }
        public string? MimeType { get; set; }
        public Guid? Id { get; set; }
    }

    private class PagedResponse
    {
        public int TotalItems { get; set; }
        public int TotalPages { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public List<ManagerRequestItem>? Items { get; set; }
    }

    // ══════════════════════════════════════════════════════════════════
    // 1. EMPTY STATE
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldReturnEmptyPage_WhenNoRequestsExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);

        var result = await controller.GetManagerRequests(null, null);
        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ReadPayload<PagedResponse>(ok.Value);

        Assert.Equal(0, payload.TotalItems);
        Assert.Empty(payload.Items!);
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. PAGINATION
    // ══════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData(0, 20, 1, 20)]
    [InlineData(1, 0, 1, 20)]
    [InlineData(1, 150, 1, 20)]
    public async Task GetManagerRequests_ShouldClampPaginationParameters(int page, int pageSize, int expectedPage, int expectedPageSize)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);

        var result = await controller.GetManagerRequests(null, null, page, pageSize);
        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = ReadPayload<PagedResponse>(ok.Value);

        Assert.Equal(expectedPage, payload.Page);
        Assert.Equal(expectedPageSize, payload.PageSize);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. FILTERING BY STATUS
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldFilterByStatus()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "U", Email = "e" };
        db.Users.Add(u);
        db.ManagerProfileRequests.AddRange(
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "PENDING" },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "APPROVED" },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "REJECTED" }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        var resPending = await controller.GetManagerRequests(null, "PENDING");
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)resPending).Value).TotalItems);

        var resApproved = await controller.GetManagerRequests(null, "approved"); // case-insensitive check
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)resApproved).Value).TotalItems);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. SEARCHING
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldSearchAcrossMultipleFields()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u1 = new User { Id = Guid.NewGuid(), FullName = "Nguyen Van A", Email = "a@shuttleup.vn" };
        var u2 = new User { Id = Guid.NewGuid(), FullName = "Tran Thi B", Email = "b@gmail.com" };
        db.Users.AddRange(u1, u2);
        db.ManagerProfileRequests.AddRange(
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u1.Id, TaxCode = "MST1", Address = "Ha Noi", Status = "PENDING" },
            new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u2.Id, TaxCode = "MST2", Address = "HCM", Status = "PENDING" }
        );
        await db.SaveChangesAsync();

        var controller = CreateController(db);

        // Name search
        var r1 = await controller.GetManagerRequests("Nguyen", null);
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)r1).Value).TotalItems);

        // Email search
        var r2 = await controller.GetManagerRequests("gmail.com", null);
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)r2).Value).TotalItems);

        // TaxCode search
        var r3 = await controller.GetManagerRequests("MST1", null);
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)r3).Value).TotalItems);

        // Address search
        var r4 = await controller.GetManagerRequests("HCM", null);
        Assert.Equal(1, ReadPayload<PagedResponse>(((OkObjectResult)r4).Value).TotalItems);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. SORTING ORDER
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldOrderingByPendingFirstThenRequestedAtDesc()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "U", Email = "e" };
        db.Users.Add(u);
        var now = DateTime.UtcNow;

        var req1 = new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "APPROVED", RequestedAt = now };
        var req2 = new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "PENDING", RequestedAt = now.AddHours(-1) };
        var req3 = new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = "PENDING", RequestedAt = now };

        db.ManagerProfileRequests.AddRange(req1, req2, req3);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetManagerRequests(null, null));
        var items = ReadPayload<PagedResponse>(ok.Value).Items!;

        // Expect req3 (PENDING, newer), then req2 (PENDING, older), then req1 (APPROVED)
        Assert.Equal(req3.Id, items[0].Id);
        Assert.Equal(req2.Id, items[1].Id);
        Assert.Equal(req1.Id, items[2].Id);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. FILE MAPPING
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldMapFileUrlsAndMimeTypes()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "U", Email = "e" };
        db.Users.Add(u);

        var file1Id = Guid.NewGuid();
        var file2Id = Guid.NewGuid();
        var licenseId = Guid.NewGuid();
        db.Files.AddRange(
            new DalFile { Id = file1Id, FileUrl = "url1", MimeType = "image/png" },
            new DalFile { Id = file2Id, FileUrl = "url2", MimeType = "image/jpeg" },
            new DalFile { Id = licenseId, FileUrl = "license_url", MimeType = "application/pdf" }
        );

        var req = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = u.Id,
            Status = "PENDING",
            CccdFrontFileId = file1Id,
            CccdBackFileId = file2Id,
            BusinessLicenseFileId1 = licenseId
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetManagerRequests(null, null));
        var item = ReadPayload<PagedResponse>(ok.Value).Items![0];

        Assert.Equal("url1", item.CccdFrontUrl);
        Assert.Equal("url2", item.CccdBackUrl);
        Assert.Single(item.BusinessLicenseFiles!);
        Assert.Equal("license_url", item.BusinessLicenseFiles![0].Url);
        Assert.Equal("application/pdf", item.BusinessLicenseFiles![0].MimeType);
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. DECISION INFO
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetManagerRequests_ShouldIncludeDecisionInfoForProcessedRequests()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "Applicant", Email = "app@x.com" };
        var admin = new User { Id = Guid.NewGuid(), FullName = "Admin User", Email = "admin@x.com" };
        db.Users.AddRange(u, admin);

        var now = DateTime.UtcNow;
        var req = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = u.Id,
            Status = "APPROVED",
            RequestedAt = now.AddDays(-1),
            AdminUserId = admin.Id,
            DecisionAt = now,
            DecisionNote = "Everything looks good."
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var ok = Assert.IsType<OkObjectResult>(await controller.GetManagerRequests(null, "APPROVED"));
        var item = ReadPayload<PagedResponse>(ok.Value).Items![0];

        Assert.Equal("Admin User", item.AdminName);
        Assert.Equal("Everything looks good.", item.DecisionNote);
        Assert.Equal(now, item.DecisionAt);
    }
}

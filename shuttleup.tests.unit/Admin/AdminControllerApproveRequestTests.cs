using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;
using static ShuttleUp.Backend.Controllers.AdminController;

namespace shuttleup.tests.unit.Admin;

public class AdminControllerApproveRequestTests
{
    private AdminController CreateController(ShuttleUpDbContext db, Guid? adminId = null)
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
                    new Claim(ClaimTypes.NameIdentifier, adminId?.ToString() ?? Guid.Empty.ToString()),
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

    // ══════════════════════════════════════════════════════════════════
    // 1. SECURITY & BOUNDARIES
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ApproveRequest_ShouldReturnUnauthorized_WhenAdminIdIsUndefined()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, adminId: null); // Guid.Empty inside

        var result = await controller.ApproveRequest(Guid.NewGuid(), new ApprovalDecisionRequest("OK"));
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task ApproveRequest_ShouldReturnNotFound_WhenRequestIdIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, adminId: Guid.NewGuid());

        var result = await controller.ApproveRequest(Guid.NewGuid(), new ApprovalDecisionRequest("OK"));
        var nf = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<MessageResponse>(nf.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. STATE TRANSITIONS
    // ══════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("APPROVED")]
    [InlineData("REJECTED")]
    public async Task ApproveRequest_ShouldReturnBadRequest_WhenRequestAlreadyProcessed(string status)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "U", Email = "e" };
        var req = new ManagerProfileRequest { Id = Guid.NewGuid(), UserId = u.Id, Status = status };
        db.Users.Add(u);
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var result = await controller.ApproveRequest(req.Id, new ApprovalDecisionRequest("Note"));
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("đã được xử lý", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. BUSINESS RULES: DOCUMENTATION VALIDATION (DANG_KY)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ApproveRequest_ShouldRejectDANG_KY_WhenDocumentsAreIncomplete()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var u = new User { Id = Guid.NewGuid(), FullName = "U", Email = "e" };
        db.Users.Add(u);

        // Missing CCCD back
        var req = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = u.Id,
            Status = "PENDING",
            RequestType = "DANG_KY",
            CccdFrontFileId = Guid.NewGuid(),
            // CccdBackFileId = null,
            BusinessLicenseFileId1 = Guid.NewGuid(),
            TaxCode = "123",
            Address = "Address"
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var result = await controller.ApproveRequest(req.Id, new ApprovalDecisionRequest("Note"));
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("chưa đủ giấy tờ", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. HAPPY PATH: DANG_KY (First time registration)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ApproveRequest_ShouldPromotePlayerToManager_WhenDANG_KYIsComplete()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId = Guid.NewGuid();
        var u = new User { Id = Guid.NewGuid(), FullName = "New Manager", Email = "m@m.com" };
        var roleManager = new Role { Id = Guid.NewGuid(), Name = "MANAGER" };
        db.Users.Add(u);
        db.Roles.Add(roleManager);

        var reqId = Guid.NewGuid();
        var fileCccdF = Guid.NewGuid();
        var fileCccdB = Guid.NewGuid();
        var fileLic = Guid.NewGuid();
        var req = new ManagerProfileRequest
        {
            Id = reqId,
            UserId = u.Id,
            Status = "PENDING",
            RequestType = "DANG_KY",
            CccdFrontFileId = fileCccdF,
            CccdBackFileId = fileCccdB,
            BusinessLicenseFileId1 = fileLic,
            TaxCode = "TAX-999",
            Address = "Stadium Road",
            RequestedAt = DateTime.UtcNow.AddDays(-1)
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: adminId);
        var result = await controller.ApproveRequest(reqId, new ApprovalDecisionRequest("Approved! System checked."));
        
        Assert.IsType<OkObjectResult>(result);

        // Verify Request Update
        var updatedReq = db.ManagerProfileRequests.Find(reqId);
        Assert.Equal("APPROVED", updatedReq!.Status);
        Assert.Equal(adminId, updatedReq.AdminUserId);
        Assert.Equal("Approved! System checked.", updatedReq.DecisionNote);

        // Verify Role Assignment
        var userWithRoles = db.Users.Include(x => x.Roles).First(x => x.Id == u.Id);
        Assert.Contains(userWithRoles.Roles, r => r.Name == "MANAGER");

        // Verify ManagerProfile Snapshot Creation
        var profile = db.ManagerProfiles.First(p => p.UserId == u.Id);
        Assert.Equal("APPROVED", profile.Status);
        Assert.Equal("TAX-999", profile.TaxCode);
        Assert.Equal("Stadium Road", profile.Address);
        Assert.Equal(fileCccdF, profile.CccdFrontFileId);
        Assert.Equal(fileLic, profile.BusinessLicenseFileId1);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. HAPPY PATH: CAP_NHAT (Updating documents)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ApproveRequest_ShouldPreserveExistingFields_WhenCAP_NHATHasPartialData()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId = Guid.NewGuid();
        var u = new User { Id = Guid.NewGuid(), FullName = "Update User", Email = "u@u.com" };
        db.Users.Add(u);

        // Existing profile
        var oldLicenseId = Guid.NewGuid();
        var oldCccdF = Guid.NewGuid();
        var profile = new ManagerProfile
        {
            UserId = u.Id,
            Status = "APPROVED",
            TaxCode = "OLD-TAX",
            Address = "Old Addr",
            CccdFrontFileId = oldCccdF,
            BusinessLicenseFileId1 = oldLicenseId
        };
        db.ManagerProfiles.Add(profile);

        // Update request: ONLY updates address and license2
        var newLicense2 = Guid.NewGuid();
        var req = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = u.Id,
            Status = "PENDING",
            RequestType = "CAP_NHAT",
            Address = "New HQ",
            BusinessLicenseFileId2 = newLicense2,
            // TaxCode = null -> preserve OLD-TAX
            // CccdFrontFileId = null -> preserve oldCccdF
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: adminId);
        await controller.ApproveRequest(req.Id, new ApprovalDecisionRequest("Updated."));

        // Verify Snapshot Merging
        var updatedProfile = db.ManagerProfiles.First(p => p.UserId == u.Id);
        Assert.Equal("New HQ", updatedProfile.Address); // Overwritten
        Assert.Equal(newLicense2, updatedProfile.BusinessLicenseFileId2); // Added
        Assert.Equal("OLD-TAX", updatedProfile.TaxCode); // Preserved
        Assert.Equal(oldCccdF, updatedProfile.CccdFrontFileId); // Preserved
        Assert.Equal(oldLicenseId, updatedProfile.BusinessLicenseFileId1); // Preserved
    }
}

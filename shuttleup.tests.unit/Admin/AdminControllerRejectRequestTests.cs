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

public class AdminControllerRejectRequestTests
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
    // 1. BOUNDARIES & INVALID INPUTS
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task RejectRequest_ShouldReturnNotFound_WhenIdIsInvalid()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db, adminId: Guid.NewGuid());

        var result = await controller.RejectRequest(Guid.NewGuid(), new ApprovalDecisionRequest("Spam"));
        var nf = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tìm thấy", ReadPayload<MessageResponse>(nf.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task RejectRequest_ShouldReturnBadRequest_WhenStatusIsNotPending()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var req = new ManagerProfileRequest { Id = Guid.NewGuid(), Status = "APPROVED" };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var result = await controller.RejectRequest(req.Id, new ApprovalDecisionRequest("Changed mind"));
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("đã được xử lý", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task RejectRequest_ShouldReturnBadRequest_WhenReasonIsMissing(string reason)
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var req = new ManagerProfileRequest { Id = Guid.NewGuid(), Status = "PENDING" };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId: Guid.NewGuid());
        var result = await controller.RejectRequest(req.Id, new ApprovalDecisionRequest(reason));
        
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("lý do từ chối", ReadPayload<MessageResponse>(bad.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. HAPPY PATH & SIDE EFFECTS (ISOLATION)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task RejectRequest_ShouldUpdateStatusAndNote_WithoutTouchingProfileOrRoles()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var adminId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        // 1. Setup existing state: User is already a MANAGER (updating info)
        var u = new User { Id = memberId, FullName = "Existing Manager", Email = "m@m.com" };
        var roleManager = new Role { Id = Guid.NewGuid(), Name = "MANAGER" };
        u.Roles.Add(roleManager);
        db.Users.Add(u);

        var profile = new ManagerProfile
        {
            UserId = memberId,
            Status = "APPROVED",
            TaxCode = "VALID-MST",
            Address = "Verified Place"
        };
        db.ManagerProfiles.Add(profile);

        // 2. The update request being rejected
        var req = new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = memberId,
            Status = "PENDING",
            RequestType = "CAP_NHAT",
            TaxCode = "FAKE-MST"
        };
        db.ManagerProfileRequests.Add(req);
        await db.SaveChangesAsync();

        // 3. Action
        var controller = CreateController(db, adminId: adminId);
        var note = "Tax code provided is invalid.";
        var result = await controller.RejectRequest(req.Id, new ApprovalDecisionRequest(note));

        Assert.IsType<OkObjectResult>(result);

        // 4. Verify Request Status
        var updatedReq = db.ManagerProfileRequests.Find(req.Id);
        Assert.Equal("REJECTED", updatedReq!.Status);
        Assert.Equal(adminId, updatedReq.AdminUserId);
        Assert.Equal(note, updatedReq.DecisionNote);

        // 5. Verify Isolation: Snapshot and Roles MUST NOT CHANGE
        var snapshot = db.ManagerProfiles.First(p => p.UserId == memberId);
        Assert.Equal("APPROVED", snapshot.Status); // Still approved
        Assert.Equal("VALID-MST", snapshot.TaxCode); // Kept the old valid one

        var user = db.Users.Include(x => x.Roles).First(x => x.Id == memberId);
        Assert.Contains(user.Roles, r => r.Name == "MANAGER"); // Kept the role
    }
}

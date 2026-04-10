using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Profile;

public class ManagerProfileControllerGetMyProfileTests
{
    private ManagerProfileController CreateController(ShuttleUpDbContext dbContext,
        IManagerProfileRepository? repo = null,
        IManagerProfileRequestRepository? requestRepo = null)
    {
        var mockRepo = repo != null ? new Mock<IManagerProfileRepository>() : new Mock<IManagerProfileRepository>();
        if (repo == null) mockRepo.Setup(r => r.GetByUserIdAsync(It.IsAny<Guid>())).ReturnsAsync((ManagerProfile?)null);
        var mockReqRepo = requestRepo != null ? new Mock<IManagerProfileRequestRepository>() : new Mock<IManagerProfileRequestRepository>();
        
        var mockUsers = new Mock<IUserRepository>();
        var mockConfig = new Mock<IConfiguration>();

        return new ManagerProfileController(
            repo ?? mockRepo.Object,
            requestRepo ?? mockReqRepo.Object,
            mockUsers.Object,
            dbContext,
            mockConfig.Object);
    }

    private class GetProfileResponse
    {
        public Guid UserId { get; set; }
        public string? Status { get; set; }
        public string? RequestType { get; set; }
        public string? TaxCode { get; set; }
        public string? Address { get; set; }
        public string? CccdFrontUrl { get; set; }
        public string? CccdBackUrl { get; set; }
        public List<BusinessLicenseFile> BusinessLicenseFiles { get; set; } = new();
        public DateTime? DecisionAt { get; set; }
        public string? DecisionNote { get; set; }
    }

    private class BusinessLicenseFile
    {
        public Guid Id { get; set; }
        public string? Url { get; set; }
        public string? MimeType { get; set; }
    }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. EMPTY / NO PROFILE
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyProfile_ShouldReturnStatusNull_WhenNoProfileOrRequestsExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = ReadPayload<JsonElement>(ok.Value);
        Assert.Null(body.GetProperty("status").GetString());
    }

    // ══════════════════════════════════════════════════════════
    // 2. FALLBACK TO SNAPSHOT (e.g. APPROVED state, no pending)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyProfile_ShouldReturnSnapshotData_WhenNoPendingRequests()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var cccdFrontId = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = cccdFrontId, FileUrl = "http://cccd", MimeType = "image/jpeg" });
        await db.SaveChangesAsync();

        var mockRepo = new Mock<IManagerProfileRepository>();
        mockRepo.Setup(r => r.GetByUserIdAsync(userId)).ReturnsAsync(new ManagerProfile
        {
            UserId = userId,
            Status = "APPROVED",
            TaxCode = "123456",
            CccdFrontFileId = cccdFrontId
        });

        var controller = CreateController(db, repo: mockRepo.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetProfileResponse>(ok.Value);

        Assert.Equal("APPROVED", data.Status);
        Assert.Equal("CAP_NHAT", data.RequestType); // Since it's APPROVED, next action is CAP_NHAT
        Assert.Equal("123456", data.TaxCode);
        Assert.Equal("http://cccd", data.CccdFrontUrl);
    }

    // ══════════════════════════════════════════════════════════
    // 3. PENDING REQUEST OVERRIDES SNAPSHOT
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyProfile_ShouldFavorPendingRequest_WhenItExists()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        
        var mockRepo = new Mock<IManagerProfileRepository>();
        mockRepo.Setup(r => r.GetByUserIdAsync(userId)).ReturnsAsync(new ManagerProfile
        {
            UserId = userId, Status = "APPROVED", TaxCode = "OLD_TAX"
        });

        db.ManagerProfileRequests.Add(new ManagerProfileRequest
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = "PENDING",
            RequestType = "CAP_NHAT",
            TaxCode = "NEW_PENDING_TAX",
            RequestedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, repo: mockRepo.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetProfileResponse>(ok.Value);

        Assert.Equal("PENDING", data.Status);
        Assert.Equal("NEW_PENDING_TAX", data.TaxCode);
    }

    // ══════════════════════════════════════════════════════════
    // 4. MAPS ALL BUSINESS LICENSES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task GetMyProfile_ShouldMapBusinessLicenseFiles()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var userId = Guid.NewGuid();
        var bl1Id = Guid.NewGuid();
        var bl3Id = Guid.NewGuid();

        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = bl1Id, FileUrl = "http://b1", MimeType = "image/png" });
        db.Files.Add(new ShuttleUp.DAL.Models.File { Id = bl3Id, FileUrl = "http://b3", MimeType = "application/pdf" });
        await db.SaveChangesAsync();

        var mockRepo = new Mock<IManagerProfileRepository>();
        mockRepo.Setup(r => r.GetByUserIdAsync(userId)).ReturnsAsync(new ManagerProfile
        {
            UserId = userId,
            Status = "PENDING",
            BusinessLicenseFileId1 = bl1Id,
            BusinessLicenseFileId3 = bl3Id  // 2 is null
        });

        var controller = CreateController(db, repo: mockRepo.Object);
        ControllerTestHelper.SetUser(controller, userId);

        var result = await controller.GetMyProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        var data = ReadPayload<GetProfileResponse>(ok.Value);

        Assert.Equal(2, data.BusinessLicenseFiles.Count);
        Assert.Contains(data.BusinessLicenseFiles, x => x.Url == "http://b1");
        Assert.Contains(data.BusinessLicenseFiles, x => x.Url == "http://b3");
    }
}

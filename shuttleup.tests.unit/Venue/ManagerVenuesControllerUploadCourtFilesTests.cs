using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Venue;

public class ManagerVenuesControllerUploadCourtFilesTests
{
    private ManagerVenuesController CreateController(ShuttleUpDbContext dbContext, Dictionary<string, string>? configMock = null)
    {
        var mockVenueService = new Mock<IVenueService>();
        var mockCourtService = new Mock<ICourtService>();
        var mockVietQr = new Mock<IOptions<VietQRSettings>>();
        mockVietQr.Setup(x => x.Value).Returns(new VietQRSettings());
        var mockNotify = new Mock<INotificationDispatchService>();
        var mockVenueReview = new Mock<IVenueReviewService>();

        mockVenueService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid id) => dbContext.Venues.FirstOrDefault(v => v.Id == id));

        var configuration = new ConfigurationBuilder();
        if (configMock != null)
        {
            configuration.AddInMemoryCollection(configMock);
        }
        var config = configuration.Build();

        var controller = new ManagerVenuesController(
            mockVenueService.Object,
            mockCourtService.Object,
            dbContext,
            config,
            mockVietQr.Object,
            mockNotify.Object,
            mockVenueReview.Object
        );

        return controller;
    }

    private class ErrorMessageResponse { public string Message { get; set; } = ""; }

    private static T ReadPayload<T>(object? payload)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })!;
    }

    // ══════════════════════════════════════════════════════════
    // 1. DATA ISOLATION / AUTHENTICATION
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCourtFiles_ShouldReturnUnauthorized_WhenNotAuthenticated()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.UploadCourtFiles(Guid.NewGuid(), Guid.NewGuid(), new List<IFormFile>());
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task UploadCourtFiles_ShouldReturnNotFound_WhenVenueDoesNotExist()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid());

        var result = await controller.UploadCourtFiles(Guid.NewGuid(), Guid.NewGuid(), new List<IFormFile>());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UploadCourtFiles_ShouldReturnForbid_WhenManagerDoesNotOwnVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var ownerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = ownerId });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, Guid.NewGuid()); // Logged in as Hacker

        var result = await controller.UploadCourtFiles(venueId, Guid.NewGuid(), new List<IFormFile>());
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task UploadCourtFiles_ShouldReturnNotFound_WhenCourtBelongsToDifferentVenue()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = Guid.NewGuid() }); // Mismatch target
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        ControllerTestHelper.SetUser(controller, managerId);

        var result = await controller.UploadCourtFiles(venueId, courtId, new List<IFormFile>());
        
        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Contains("không tồn tại trong venue", ReadPayload<ErrorMessageResponse>(notFound.Value).Message.ToLowerInvariant());
    }

    // ══════════════════════════════════════════════════════════
    // 2. FILE PURGE PROTOCOLS (NO IMAGES SUBMITTED)
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCourtFiles_ShouldClearExistingFiles_WhenUploadedListIsEmpty()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        
        var court = new Court { Id = courtId, VenueId = venueId };
        
        // Simulating physical file relations loaded in
        var existingFile = new ShuttleUp.DAL.Models.File { Id = Guid.NewGuid(), FileUrl = "test.png" };
        db.Files.Add(existingFile);
        court.Files.Add(existingFile);
        
        db.Courts.Add(court);
        await db.SaveChangesAsync();

        var controller = CreateController(db); // Null config is fine here
        ControllerTestHelper.SetUser(controller, managerId);

        // FE sends 0 files targeting a complete purge
        var result = await controller.UploadCourtFiles(venueId, courtId, new List<IFormFile>());

        var ok = Assert.IsType<OkObjectResult>(result);
        
        // Assert native Many-to-Many deletion was successfully intercepted
        var updatedCourt = await db.Courts.Include(c => c.Files).FirstAsync(c => c.Id == courtId);
        Assert.Empty(updatedCourt.Files);
    }

    // ══════════════════════════════════════════════════════════
    // 3. CLOUDINARY HARD-DEPENDENCY FAIL-SAFES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public async Task UploadCourtFiles_ShouldReturn500_WhenCloudinarySecretsAreMissing()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        await db.SaveChangesAsync();

        // Providing deliberately empty mock config mapping for Cloudinary
        var dict = new Dictionary<string, string>
        {
            { "Cloudinary:CloudName", "" }, { "Cloudinary:ApiKey", "" }, { "Cloudinary:ApiSecret", "" }
        };
        
        var controller = CreateController(db, dict);
        ControllerTestHelper.SetUser(controller, managerId);

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(100); // Pass basic size checks
        mockFile.Setup(f => f.FileName).Returns("demo.png");

        var result = await controller.UploadCourtFiles(venueId, courtId, new List<IFormFile> { mockFile.Object });

        var sc = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, sc.StatusCode);
        Assert.Contains("chưa cấu hình cloudinary", ReadPayload<ErrorMessageResponse>(sc.Value).Message.ToLowerInvariant());
    }

    [Fact]
    public async Task UploadCourtFiles_ShouldReturn500FromCatchBlock_WhenSimulatingUploadFailureWithFakeCredentials()
    {
        await using var db = ControllerTestHelper.CreateInMemoryDbContext();
        var managerId = Guid.NewGuid();
        var venueId = Guid.NewGuid();
        var courtId = Guid.NewGuid();

        db.Venues.Add(new ShuttleUp.DAL.Models.Venue { Id = venueId, OwnerUserId = managerId });
        db.Courts.Add(new Court { Id = courtId, VenueId = venueId });
        await db.SaveChangesAsync();

        // Injecting Fake APIs so it bypasses secret boundary logic 
        var fakeConfig = new Dictionary<string, string>
        {
            { "Cloudinary:CloudName", "fakeName" }, 
            { "Cloudinary:ApiKey", "12345" }, 
            { "Cloudinary:ApiSecret", "fakeSecret" }
        };
        
        var controller = CreateController(db, fakeConfig);
        ControllerTestHelper.SetUser(controller, managerId);

        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.Length).Returns(100); 
        mockFile.Setup(f => f.FileName).Returns("demo.png");
        var ms = new MemoryStream(new byte[] { 0x01, 0x02 }); // Fake buffer
        mockFile.Setup(f => f.OpenReadStream()).Returns(ms); 

        // Under execution, `new Cloudinary(account).UploadAsync()` will natively hit a 3rd party web refusal
        var result = await controller.UploadCourtFiles(venueId, courtId, new List<IFormFile> { mockFile.Object });

        var sc = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, sc.StatusCode);
        Assert.Contains("upload exception", ReadPayload<ErrorMessageResponse>(sc.Value).Message.ToLowerInvariant());
    }
}

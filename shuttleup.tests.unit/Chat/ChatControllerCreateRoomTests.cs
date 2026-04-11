using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;
using shuttleup.tests.unit.Dependencies;

namespace shuttleup.tests.unit.Chat;

public class ChatControllerCreateRoomTests
{
    private ChatController CreateController(
        IChatService? chatService = null,
        Guid? loggedInUserId = null)
    {
        var mockChat = chatService != null ? Mock.Get(chatService) : new Mock<IChatService>();
        var mockFile = new Mock<IFileService>();
        var db = ControllerTestHelper.CreateInMemoryDbContext();

        var controller = new ChatController(mockChat.Object, mockFile.Object, db);

        if (loggedInUserId.HasValue)
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[]
            {
                new Claim(ClaimTypes.NameIdentifier, loggedInUserId.Value.ToString()),
            }, "mock"));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }
        else
        {
            // Not authenticated: [Authorize] would normally block this, but we test the hard-parse behaviour
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    // Helper – put ModelState errors into the controller exactly as ASP.NET would
    private static void SimulateModelStateError(ChatController controller, string key, string message)
        => controller.ModelState.AddModelError(key, message);

    // ══════════════════════════════════════════════════════════════════
    // 1. DTO VALIDATION — [Required] on Name, [MaxLength(255)]
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldReturnBadRequest_WhenNameIsMissing()
    {
        var creatorId = Guid.NewGuid();
        var controller = CreateController(loggedInUserId: creatorId);

        // Simulate what ASP.NET model binding reports when Name is null/absent
        SimulateModelStateError(controller, nameof(CreateRoomRequestDto.Name), "The Name field is required.");

        var result = await controller.CreateRoom(new CreateRoomRequestDto { Name = null! });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateRoom_ShouldReturnBadRequest_WhenNameExceeds255Chars()
    {
        var creatorId = Guid.NewGuid();
        var controller = CreateController(loggedInUserId: creatorId);

        // Exceed MaxLength(255)
        var longName = new string('A', 256);
        SimulateModelStateError(controller, nameof(CreateRoomRequestDto.Name), "The field Name must be a string with a maximum length of 255.");

        var result = await controller.CreateRoom(new CreateRoomRequestDto { Name = longName });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. ANON / MISSING-SUB throws at CurrentUserId property
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldThrow_WhenUserHasNoSubClaim()
    {
        var controller = CreateController(loggedInUserId: null); // No NameIdentifier claim seeded

        // The property CurrentUserId does Guid.Parse(…!.Value) — throws when Value is null
        await Assert.ThrowsAnyAsync<Exception>(async () =>
            await controller.CreateRoom(new CreateRoomRequestDto { Name = "Room X" }));
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. HAPPY PATH — service is called, 201 CreatedAtAction returned
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldDelegate_ToServiceAndReturn201_WhenRequestIsValid()
    {
        var creatorId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        var roomResponse = new RoomResponseDto
        {
            Id = Guid.NewGuid(),
            Name = "Team Badminton",
            CreatedAt = DateTime.UtcNow,
            Members = new List<MemberDto>
            {
                new MemberDto { UserId = creatorId, FullName = "Huy Creator" }
            }
        };

        var request = new CreateRoomRequestDto
        {
            Name = "Team Badminton",
            MemberIds = [Guid.NewGuid(), Guid.NewGuid()] // Extra invitees
        };

        mockService
            .Setup(s => s.CreateRoomAsync(creatorId, request))
            .ReturnsAsync(roomResponse);

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: creatorId);

        var result = await controller.CreateRoom(request);

        // Controller uses CreatedAtAction — returns 201
        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(201, created.StatusCode);

        var returned = Assert.IsType<RoomResponseDto>(created.Value);
        Assert.Equal("Team Badminton", returned.Name);

        // Verify exact delegation once with the right caller identity
        mockService.Verify(s => s.CreateRoomAsync(creatorId, request), Times.Once);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. EMPTY MemberIds list — still valid (room of 1 is allowed)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldSucceed_WhenMemberIdsIsEmptyList()
    {
        var creatorId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        var request = new CreateRoomRequestDto
        {
            Name = "Solo Room",
            MemberIds = [] // Minimum: just the creator
        };

        mockService
            .Setup(s => s.CreateRoomAsync(creatorId, request))
            .ReturnsAsync(new RoomResponseDto { Id = Guid.NewGuid(), Name = "Solo Room" });

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: creatorId);

        var result = await controller.CreateRoom(request);

        Assert.IsType<CreatedAtActionResult>(result);
        mockService.Verify(s => s.CreateRoomAsync(creatorId, request), Times.Once);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. SERVICE FAILURE — underlying exception propagates correctly
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldPropagateException_WhenServiceThrows()
    {
        var creatorId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        mockService
            .Setup(s => s.CreateRoomAsync(It.IsAny<Guid>(), It.IsAny<CreateRoomRequestDto>()))
            .ThrowsAsync(new InvalidOperationException("Database write failed."));

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: creatorId);

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await controller.CreateRoom(new CreateRoomRequestDto { Name = "Crash Room" }));
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. BOUNDARY — Name exactly at limit (255 chars) should pass
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CreateRoom_ShouldSucceed_WhenNameIsExactly255Chars()
    {
        var creatorId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        var exactName = new string('V', 255);
        var request = new CreateRoomRequestDto { Name = exactName };

        mockService
            .Setup(s => s.CreateRoomAsync(creatorId, request))
            .ReturnsAsync(new RoomResponseDto { Id = Guid.NewGuid(), Name = exactName });

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: creatorId);
        // ModelState is valid when exactly at boundary – no errors added

        var result = await controller.CreateRoom(request);
        Assert.IsType<CreatedAtActionResult>(result);
    }
}

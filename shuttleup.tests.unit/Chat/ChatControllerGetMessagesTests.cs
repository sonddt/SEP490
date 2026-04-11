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

public class ChatControllerGetMessagesTests
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
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        return controller;
    }

    // ══════════════════════════════════════════════════════════════════
    // 1. UNAUTHENTICATED — CurrentUserId property hard-throws
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldThrow_WhenUserHasNoSubClaim()
    {
        var controller = CreateController(loggedInUserId: null);
        // No NameIdentifier claim → Guid.Parse(null!.Value) throws
        await Assert.ThrowsAnyAsync<Exception>(async () =>
            await controller.GetMessages(Guid.NewGuid()));
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. NON-MEMBER ACCESS — service throws UnauthorizedAccessException
    //    Controller must catch it and return Forbid (not 500)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldReturnForbid_WhenUserIsNotRoomMember()
    {
        var alienId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        mockService
            .Setup(s => s.GetMessagesAsync(roomId, alienId, It.IsAny<int>()))
            .ThrowsAsync(new UnauthorizedAccessException("User is not a member of this room."));

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: alienId);

        var result = await controller.GetMessages(roomId);

        // Controller must convert UnauthorizedAccessException → ForbidResult (not 500)
        Assert.IsType<ForbidResult>(result);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. HAPPY PATH — default page = 1 result correctly delegated
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldDelegateDefaultPageOne_AndReturnOk()
    {
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        var expectedMessages = new List<MessageResponseDto>
        {
            new MessageResponseDto { Id = Guid.NewGuid(), RoomId = roomId, SenderName = "Huy", MessageText = "Xin chào!" },
            new MessageResponseDto { Id = Guid.NewGuid(), RoomId = roomId, SenderName = "Nam", MessageText = "Chào bạn!" }
        };

        mockService
            .Setup(s => s.GetMessagesAsync(roomId, memberId, 1))
            .ReturnsAsync(expectedMessages);

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: memberId);

        // Call without supplying page → default = 1
        var result = await controller.GetMessages(roomId);
        var ok = Assert.IsType<OkObjectResult>(result);

        var returnedMessages = Assert.IsType<List<MessageResponseDto>>(ok.Value);
        Assert.Equal(2, returnedMessages.Count);
        Assert.Equal("Xin chào!", returnedMessages[0].MessageText);

        // Verify page 1 was forwarded, not page 0 or other default
        mockService.Verify(s => s.GetMessagesAsync(roomId, memberId, 1), Times.Once);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. PAGINATION — explicit page number forwarded faithfully
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldForwardExplicitPageNumber_ToService()
    {
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        mockService
            .Setup(s => s.GetMessagesAsync(roomId, memberId, 3))
            .ReturnsAsync(new List<MessageResponseDto>());

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: memberId);

        var result = await controller.GetMessages(roomId, page: 3);
        Assert.IsType<OkObjectResult>(result);

        // Strict verification — page 3 was passed, not page 1
        mockService.Verify(s => s.GetMessagesAsync(roomId, memberId, 3), Times.Once);
        mockService.Verify(s => s.GetMessagesAsync(roomId, memberId, 1), Times.Never);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. EMPTY ROOM — service returns empty list → still Ok (not 404)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldReturnOkWithEmptyList_WhenNoMessagesExist()
    {
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        mockService
            .Setup(s => s.GetMessagesAsync(roomId, memberId, 1))
            .ReturnsAsync(new List<MessageResponseDto>());

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: memberId);

        var result = await controller.GetMessages(roomId);
        var ok = Assert.IsType<OkObjectResult>(result);

        var messages = Assert.IsType<List<MessageResponseDto>>(ok.Value);
        Assert.Empty(messages); // Empty room is valid, not an error
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. NON-UNAUTHORIZED EXCEPTION — should NOT be caught by the handler
    //    (controller only catches UnauthorizedAccessException specifically)
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldPropagateNonUnauthorizedException_Unhandled()
    {
        var memberId = Guid.NewGuid();
        var roomId = Guid.NewGuid();
        var mockService = new Mock<IChatService>();

        mockService
            .Setup(s => s.GetMessagesAsync(roomId, memberId, It.IsAny<int>()))
            .ThrowsAsync(new InvalidOperationException("DB connection lost."));

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: memberId);

        // Must propagate — the catch block only handles UnauthorizedAccessException
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await controller.GetMessages(roomId));
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. CALLER IDENTITY ISOLATION — two users cannot share pages
    //    Service receives distinctly different userId values
    // ══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetMessages_ShouldPassCallerIdNotSomeoneElsesId_ToService()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var roomId = Guid.NewGuid();

        var mockService = new Mock<IChatService>();
        mockService
            .Setup(s => s.GetMessagesAsync(roomId, userId1, 1))
            .ReturnsAsync(new List<MessageResponseDto> { new MessageResponseDto { Id = Guid.NewGuid() } });

        var controller = CreateController(chatService: mockService.Object, loggedInUserId: userId1);
        await controller.GetMessages(roomId);

        // userId2 must NEVER be used when userId1 is the authenticated caller
        mockService.Verify(s => s.GetMessagesAsync(roomId, userId2, It.IsAny<int>()), Times.Never);
        mockService.Verify(s => s.GetMessagesAsync(roomId, userId1, 1), Times.Once);
    }
}

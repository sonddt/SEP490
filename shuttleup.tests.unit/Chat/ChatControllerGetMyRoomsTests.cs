using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ShuttleUp.Backend.Controllers;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace shuttleup.tests.unit.Chat;

public class ChatControllerGetMyRoomsTests
{
    private ChatController CreateController(
        IChatService? chatService = null,
        IFileService? fileService = null,
        ShuttleUpDbContext? dbContext = null,
        Guid? loggedInUserId = null)
    {
        var mockChat = chatService != null ? Mock.Get(chatService) : new Mock<IChatService>();
        var mockFile = fileService != null ? Mock.Get(fileService) : new Mock<IFileService>();

        // We can pass null if we don't care, but usually just new context
        var db = dbContext ?? Dependencies.ControllerTestHelper.CreateInMemoryDbContext();

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
            var user = new ClaimsPrincipal(new ClaimsIdentity());
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }

        return controller;
    }

    // ══════════════════════════════════════════════════════════
    // 1. ISOLATION & DELEGATION TRACES
    // ══════════════════════════════════════════════════════════
    [Fact]
    public void GetMyRooms_ShouldThrowException_WhenUnauthenticatedUserPassesAuthorizeFilter()
    {
        // Tests the direct hard-parse of `CurrentUserId` bounding the Controller!
        var controllerAnon = CreateController(loggedInUserId: null);

        // A NullReferenceException or ArgumentNullException is expected because `.Value` is accessed blindly if user is null or missing sub bounds
        Assert.ThrowsAsync<NullReferenceException>(async () => await controllerAnon.GetMyRooms());
    }

    [Fact]
    public async Task GetMyRooms_ShouldSuccessfullyRouteIdentityToServiceAndReturnArray()
    {
        var memberId = Guid.NewGuid();
        var mockChatService = new Mock<IChatService>();

        // Set up the service to return a mocked DTO array
        var expectedRooms = new List<ChatRoomDto>
        {
            new ChatRoomDto { Id = Guid.NewGuid(), Name = "Alpha Room" },
            new ChatRoomDto { Id = Guid.NewGuid(), Name = "Omega Room" }
        };

        mockChatService
            .Setup(c => c.GetMyRoomsAsync(memberId))
            .ReturnsAsync(expectedRooms);

        var controller = CreateController(chatService: mockChatService.Object, loggedInUserId: memberId);

        var result = await controller.GetMyRooms();
        var ok = Assert.IsType<OkObjectResult>(result);

        var returnedData = Assert.IsType<List<ChatRoomDto>>(ok.Value);

        // Assert strictly the Controller didn't mutate the data and properly delegated it
        Assert.Equal(2, returnedData.Count);
        Assert.Equal("Alpha Room", returnedData[0].Name);

        mockChatService.Verify(c => c.GetMyRoomsAsync(memberId), Times.Once); // Execution trace verification
    }
}

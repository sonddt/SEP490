using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")!.Value);

    /// <summary>Lấy danh sách room của user hiện tại</summary>
    [HttpGet("rooms")]
    public async Task<IActionResult> GetMyRooms()
    {
        var rooms = await _chatService.GetMyRoomsAsync(CurrentUserId);
        return Ok(rooms);
    }

    /// <summary>Tạo group chat mới</summary>
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom([FromBody] CreateRoomRequestDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var room = await _chatService.CreateRoomAsync(CurrentUserId, request);
        return CreatedAtAction(nameof(GetMyRooms), room);
    }

    /// <summary>Lấy lịch sử tin nhắn (page=1 là mới nhất)</summary>
    [HttpGet("rooms/{roomId}/messages")]
    public async Task<IActionResult> GetMessages(Guid roomId, [FromQuery] int page = 1)
    {
        try
        {
            var messages = await _chatService.GetMessagesAsync(roomId, CurrentUserId, page);
            return Ok(messages);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    /// <summary>Upload ảnh để gửi kèm tin nhắn (trả về fileId cho SignalR SendMessage)</summary>
    [HttpPost("rooms/{roomId}/upload-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadChatImage(Guid roomId, IFormFile file)
    {
        try
        {
            var result = await _chatService.UploadChatImageAsync(roomId, CurrentUserId, file, HttpContext.RequestAborted);
            return Ok(new { fileId = result.Id, url = result.Url });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message });
        }
    }
}

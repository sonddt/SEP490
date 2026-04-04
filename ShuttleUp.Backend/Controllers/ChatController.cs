using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Chat;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;
    private readonly IFileService _fileService;
    private readonly ShuttleUpDbContext _db;

    public ChatController(IChatService chatService, IFileService fileService, ShuttleUpDbContext db)
    {
        _chatService = chatService;
        _fileService = fileService;
        _db = db;
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
        if (!await _chatService.IsMemberAsync(roomId, CurrentUserId))
            return Forbid();

        if (file == null || file.Length <= 0)
            return BadRequest(new { message = "Vui lòng chọn ảnh." });
        if (file.ContentType == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ được đính kèm file ảnh." });

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadChatImageAsync(file, roomId, CurrentUserId, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message });
        }

        var fileRow = new DalFile
        {
            Id = Guid.NewGuid(),
            FileUrl = secureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = CurrentUserId,
            CreatedAt = DateTime.UtcNow
        };
        _db.Files.Add(fileRow);
        await _db.SaveChangesAsync();

        return Ok(new { fileId = fileRow.Id, url = secureUrl });
    }
}

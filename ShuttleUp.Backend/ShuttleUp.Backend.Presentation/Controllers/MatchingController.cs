using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Matching;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/matching")]
[Authorize]
public class MatchingController : ControllerBase
{
    private readonly IMatchingService _matchingService;
    private readonly IMatchingCommentService _commentService;

    public MatchingController(
        IMatchingService matchingService,
        IMatchingCommentService commentService)
    {
        _matchingService = matchingService;
        _commentService = commentService;
    }

    private Guid GetCurrentUserId()
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out var id) ? id : Guid.Empty;
    }

    [HttpGet("posts")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOpenPosts(
        [FromQuery] string? skillLevel,
        [FromQuery] string? province,
        [FromQuery] DateOnly? playDate,
        [FromQuery] string? sort,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var me);
        var result = await _matchingService.GetOpenPostsAsync(skillLevel, province, playDate, sort, q, page, pageSize, me, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpGet("posts/my")]
    public async Task<IActionResult> GetMyPosts()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();
        var result = await _matchingService.GetMyPostsAsync(me, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpGet("posts/joined")]
    public async Task<IActionResult> GetJoinedPosts()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();
        var result = await _matchingService.GetJoinedPostsAsync(me, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpGet("posts/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPostDetail(Guid id)
    {
        Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var me);
        var result = await _matchingService.GetPostDetailAsync(id, me, HttpContext.RequestAborted);
        if (result == null) return NotFound(new { message = "Không tìm thấy bài đăng." });
        return Ok(result);
    }

    [HttpPost("posts")]
    public async Task<IActionResult> CreatePost([FromBody] CreateMatchingPostDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        if (dto.RequiredPlayers < 1)
            return BadRequest(new { message = "Vui lòng nhập số người cần tìm (ít nhất 1)." });

        try
        {
            var id = await _matchingService.CreatePostAsync(me, dto, HttpContext.RequestAborted);
            return Ok(new { id, message = "Tuyệt vời! Bài đăng đã được tạo thành công." });
        }
        catch (KeyNotFoundException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("posts/{id:guid}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdateMatchingPostDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _matchingService.UpdatePostAsync(id, me, dto, HttpContext.RequestAborted);
            return Ok(new { message = "Đã cập nhật bài đăng." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("posts/{id:guid}/close")]
    public async Task<IActionResult> ClosePost(Guid id)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _matchingService.ClosePostAsync(id, me, HttpContext.RequestAborted);
            return Ok(new { message = "Bài đăng đã được đóng." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("posts/{id:guid}/reopen")]
    public async Task<IActionResult> ReopenPost(Guid id)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var status = await _matchingService.ReopenPostAsync(id, me, HttpContext.RequestAborted);
            return Ok(new
            {
                message = status == "FULL"
                    ? "Đã mở lại — nhóm vẫn đủ người nên bài ở trạng thái đầy chỗ."
                    : "Đã mở lại bài đăng — người chơi có thể xin tham gia trở lại.",
                status
            });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("posts/{id:guid}/join")]
    public async Task<IActionResult> JoinPost(Guid id, [FromBody] JoinDto? dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var requestId = await _matchingService.JoinPostAsync(id, me, dto?.Message, HttpContext.RequestAborted);
            return Ok(new { id = requestId, message = "Đã gửi yêu cầu tham gia. Hãy chờ chủ bài duyệt nhé!" });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("posts/{id:guid}/join")]
    public async Task<IActionResult> CancelJoinRequest(Guid id)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _matchingService.CancelJoinRequestAsync(id, me, HttpContext.RequestAborted);
            return Ok(new { message = "Đã hủy yêu cầu tham gia." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("join-requests/{id:guid}/accept")]
    public async Task<IActionResult> AcceptJoinRequest(Guid id)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _matchingService.AcceptJoinRequestAsync(id, me, HttpContext.RequestAborted);
            return Ok(new { message = "Đã chấp nhận thành viên mới vào nhóm." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost("join-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectJoinRequest(Guid id, [FromBody] RejectRequestDto? dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _matchingService.RejectJoinRequestAsync(id, me, dto?.Reason, HttpContext.RequestAborted);
            return Ok(new { message = "Đã từ chối yêu cầu." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpDelete("members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid memberId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var msg = await _matchingService.RemoveMemberAsync(memberId, me, HttpContext.RequestAborted);
            return Ok(new { message = msg });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    // =========================================================================
    // COMMENTS
    // =========================================================================

    [HttpGet("posts/{id:guid}/comments")]
    public async Task<IActionResult> GetCommentRoots(
        Guid id,
        [FromQuery] string sort = "newest",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _commentService.GetRootCommentsPagedAsync(id, me, sort, page, pageSize, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("posts/{postId:guid}/comments/{rootId:guid}/replies")]
    public async Task<IActionResult> GetCommentReplies(Guid postId, Guid rootId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _commentService.GetRepliesPagedAsync(postId, rootId, me, page, pageSize, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("posts/{postId:guid}/comments/upload-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> UploadCommentImage(Guid postId, IFormFile file)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var (fileId, url) = await _commentService.UploadCommentImageAsync(me, postId, file, HttpContext.RequestAborted);
            return Ok(new { fileId, url });
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = "Tải ảnh lên thất bại: " + ex.Message }); }
    }

    [HttpPost("posts/{id:guid}/comments")]
    public async Task<IActionResult> PostComment(Guid id, [FromBody] CreateMatchingCommentDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _commentService.PostCommentAsync(me, id, dto, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPatch("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> PatchComment(Guid postId, Guid commentId, [FromBody] CreateMatchingCommentDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _commentService.UpdateCommentAsync(me, postId, commentId, dto, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("posts/{postId:guid}/comments/{commentId:guid}")]
    public async Task<IActionResult> SoftDeleteComment(Guid postId, Guid commentId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _commentService.DeleteCommentAsync(me, postId, commentId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã gỡ bình luận." });
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("bookings")]
    public async Task<IActionResult> GetUpcomingBookings()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        var result = await _matchingService.GetUpcomingBookingsAsync(me, HttpContext.RequestAborted);
        return Ok(result);
    }

    // Inner DTOs for simple requests
    public class JoinDto { public string? Message { get; set; } }
    public class RejectRequestDto { public string? Reason { get; set; } }
}

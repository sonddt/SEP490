using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Social;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/social")]
[Authorize]
public class SocialController : ControllerBase
{
    private readonly ISocialService _socialService;

    public SocialController(ISocialService socialService)
    {
        _socialService = socialService;
    }

    private Guid GetCurrentUserId()
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out var id) ? id : Guid.Empty;
    }

    [HttpGet("privacy")]
    public async Task<IActionResult> GetPrivacy()
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        
        var p = await _socialService.GetPrivacyAsync(userId, HttpContext.RequestAborted);
        return Ok(new { allowFindByEmail = p.AllowFindByEmail, allowFindByPhone = p.AllowFindByPhone });
    }

    [HttpPut("privacy")]
    public async Task<IActionResult> PutPrivacy([FromBody] PrivacyDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        
        var p = await _socialService.UpdatePrivacyAsync(userId, dto, HttpContext.RequestAborted);
        return Ok(new { message = "Đã lưu cài đặt riêng tư.", allowFindByEmail = p.AllowFindByEmail, allowFindByPhone = p.AllowFindByPhone });
    }

    [HttpGet("users/search/exact")]
    public async Task<IActionResult> SearchExact([FromQuery] string? query)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        
        var result = await _socialService.SearchExactAsync(userId, query ?? "", HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpGet("users/search/name")]
    public async Task<IActionResult> SearchByName([FromQuery] string? q, [FromQuery] int take = 15)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty) return Unauthorized();
        
        var result = await _socialService.SearchByNameAsync(userId, q ?? "", take, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpPost("friend-requests")]
    public async Task<IActionResult> SendFriendRequest([FromBody] SendRequestDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _socialService.SendFriendRequestAsync(me, dto.ToUserId, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("friend-requests/sent/{toUserId:guid}")]
    public async Task<IActionResult> CancelSentRequest(Guid toUserId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.CancelSentRequestAsync(me, toUserId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã thu hồi lời mời." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("friend-requests/{requestId:guid}/accept")]
    public async Task<IActionResult> AcceptRequest(Guid requestId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.AcceptRequestAsync(me, requestId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã chấp nhận — giờ hai bạn là bạn bè." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("friend-requests/{requestId:guid}/decline")]
    public async Task<IActionResult> DeclineRequest(Guid requestId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.DeclineRequestAsync(me, requestId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã từ chối lời mời." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpGet("friend-requests/incoming")]
    public async Task<IActionResult> IncomingRequests()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();
        
        var list = await _socialService.GetIncomingRequestsAsync(me, HttpContext.RequestAborted);
        return Ok(list);
    }

    [HttpGet("friend-requests/sent")]
    public async Task<IActionResult> SentRequests()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();
        
        var list = await _socialService.GetSentRequestsAsync(me, HttpContext.RequestAborted);
        return Ok(list);
    }

    [HttpGet("friends")]
    public async Task<IActionResult> Friends()
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();
        
        var list = await _socialService.GetFriendsAsync(me, HttpContext.RequestAborted);
        return Ok(list);
    }

    [HttpDelete("friends/{userId:guid}")]
    public async Task<IActionResult> Unfriend(Guid userId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.UnfriendAsync(me, userId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã hủy kết bạn." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("blocks")]
    public async Task<IActionResult> Block([FromBody] BlockDto dto)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.BlockUserAsync(me, dto.BlockedUserId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã chặn người dùng này." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("blocks/{userId:guid}")]
    public async Task<IActionResult> Unblock(Guid userId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            await _socialService.UnblockUserAsync(me, userId, HttpContext.RequestAborted);
            return Ok(new { message = "Đã bỏ chặn." });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpGet("relationship/{otherUserId:guid}")]
    public async Task<IActionResult> GetRelationship(Guid otherUserId)
    {
        var me = GetCurrentUserId();
        if (me == Guid.Empty) return Unauthorized();

        try
        {
            var result = await _socialService.GetRelationshipAsync(me, otherUserId, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }
}

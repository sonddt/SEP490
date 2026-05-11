using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Featured;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/admin/featured-posts")]
[Authorize(Roles = "ADMIN")]
public class AdminFeaturedPostsController : ControllerBase
{
    private readonly IFeaturedPostService _featuredPostService;
    private readonly IFileService _fileService;

    public AdminFeaturedPostsController(IFeaturedPostService featuredPostService, IFileService fileService)
    {
        _featuredPostService = featuredPostService;
        _fileService = fileService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var list = await _featuredPostService.GetAllAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FeaturedPostUpsertDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized();

        try
        {
            var result = await _featuredPostService.CreateAsync(userId, "ADMIN", dto);
            return Ok(new { result.Id, message = "Đã tạo bài đăng." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] FeaturedPostUpsertDto dto)
    {
        try
        {
            // Admin can edit any post — no requiredAuthorId
            await _featuredPostService.UpdateAsync(id, null, "ADMIN", dto);
            return Ok(new { message = "Đã cập nhật." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id)
    {
        try
        {
            // Admin can delete any post
            await _featuredPostService.DeleteAsync(id, null, "ADMIN");
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("upload-image")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty)
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không có file ảnh." });

        var result = await _fileService.UploadFeaturedPostImageAsync(file, adminId, HttpContext.RequestAborted);
        return Ok(new { url = result.SecureUrl });
    }

    private Guid GetCurrentUserId()
    {
        var c = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(c?.Value, out var id) ? id : Guid.Empty;
    }
}

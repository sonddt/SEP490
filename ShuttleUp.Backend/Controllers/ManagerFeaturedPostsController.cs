using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Featured;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/featured-posts")]
[Authorize(Roles = "MANAGER")]
public class ManagerFeaturedPostsController : ControllerBase
{
    private readonly IFeaturedPostService _featuredPostService;
    private readonly IFileService _fileService;

    public ManagerFeaturedPostsController(IFeaturedPostService featuredPostService, IFileService fileService)
    {
        _featuredPostService = featuredPostService;
        _fileService = fileService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized();

        var list = await _featuredPostService.GetByAuthorAsync(managerId, "MANAGER");
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FeaturedPostUpsertDto dto)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized();

        try
        {
            var result = await _featuredPostService.CreateAsync(managerId, "MANAGER", dto);
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
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized();

        try
        {
            await _featuredPostService.UpdateAsync(id, managerId, "MANAGER", dto);
            return Ok(new { message = "Đã cập nhật." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized();

        try
        {
            await _featuredPostService.DeleteAsync(id, managerId, "MANAGER");
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("upload-image")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không có file ảnh." });

        var result = await _fileService.UploadFeaturedPostImageAsync(file, managerId, HttpContext.RequestAborted);
        return Ok(new { url = result.SecureUrl });
    }

    private Guid GetCurrentUserId()
    {
        var c = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(c?.Value, out var id) ? id : Guid.Empty;
    }
}

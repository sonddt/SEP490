using System;
using System.Security.Claims;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Report;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        userId = Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
        return userId != Guid.Empty;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyReports([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var result = await _reportService.GetMyReportsAsync(userId, page, pageSize);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequestDto dto)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        try
        {
            var reportId = await _reportService.CreateReportAsync(userId, dto);
            return Ok(new { id = reportId, message = "Đã gửi report. Cảm ơn bạn đã giúp ShuttleUp tốt hơn." });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (System.Collections.Generic.KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost("{reportId:guid}/upload-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadReportImage([FromRoute] Guid reportId, IFormFile file)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        
        if (file == null || file.Length <= 0)
            return BadRequest(new { message = "Vui lòng chọn ảnh." });
        if (file.ContentType == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ được đính kèm file ảnh." });
        if (file.Length > 5_000_000)
            return BadRequest(new { message = "Ảnh tối đa 5 MB." });

        try
        {
            var result = await _reportService.UploadReportImageAsync(userId, file, reportId, HttpContext.RequestAborted);
            return Ok(new { fileId = result.Id, url = result.Url });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
        }
    }
}

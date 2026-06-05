using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/refunds")]
[Authorize(Roles = "MANAGER")]
public class ManagerRefundsController : ControllerBase
{
    private readonly IRefundService _refundService;
    private readonly IFileService _fileService;
    private readonly IFileRepository _fileRepository;

    public ManagerRefundsController(
        IRefundService refundService,
        IFileService fileService,
        IFileRepository fileRepository)
    {
        _refundService = refundService;
        _fileService = fileService;
        _fileRepository = fileRepository;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    [HttpGet]
    public async Task<IActionResult> GetRefundRequests([FromQuery] string? status)
    {
        if (!TryGetCurrentUserId(out var managerId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var rows = await _refundService.GetRefundRequestsAsync(managerId, status, HttpContext.RequestAborted);
        return Ok(rows);
    }

    public class ReconcileDto
    {
        public bool Confirmed { get; set; }
        public string? Reason { get; set; }
    }

    [HttpPatch("{refundId:guid}/reconcile")]
    public async Task<IActionResult> Reconcile([FromRoute] Guid refundId, [FromBody] ReconcileDto dto)
    {
        if (!TryGetCurrentUserId(out var managerId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var result = await _refundService.ReconcileAsync(refundId, managerId, dto.Confirmed, dto.Reason, HttpContext.RequestAborted);
            return Ok(new { message = result.Message, status = result.Status });
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    public class CompleteRefundDto
    {
        public string? ManagerNote { get; set; }
    }

    [HttpPatch("{refundId:guid}/complete")]
    public async Task<IActionResult> CompleteRefund([FromRoute] Guid refundId, [FromBody] CompleteRefundDto? dto)
    {
        if (!TryGetCurrentUserId(out var managerId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        try
        {
            var result = await _refundService.CompleteRefundAsync(refundId, managerId, dto?.ManagerNote, HttpContext.RequestAborted);
            return Ok(new { message = result.Message, status = result.Status });
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{refundId:guid}/upload-evidence")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> UploadEvidence([FromRoute] Guid refundId, IFormFile file)
    {
        if (!TryGetCurrentUserId(out var managerId))
            return Unauthorized(new { message = "Không xác định được người dùng." });
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng tải ảnh bill CK." });
        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File phải là ảnh." });

        var upload = await _fileService.UploadPaymentProofAsync(file, Guid.Empty, HttpContext.RequestAborted);

        var fileEntity = new DalFile
        {
            Id = Guid.NewGuid(),
            FileUrl = upload.SecureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int)file.Length,
            UploadedByUserId = managerId,
            CreatedAt = DateTime.UtcNow,
        };
        await _fileRepository.AddFileAsync(fileEntity);

        try
        {
            await _refundService.UploadEvidenceAsync(refundId, managerId, fileEntity.Id, HttpContext.RequestAborted);
            return Ok(new { message = "Đã tải ảnh bill CK hoàn tiền.", fileUrl = upload.SecureUrl });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}

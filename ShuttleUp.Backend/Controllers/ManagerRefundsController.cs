using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/refunds")]
[Authorize(Roles = "MANAGER")]
public class ManagerRefundsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IRefundService _refundService;
    private readonly IFileService _fileService;

    public ManagerRefundsController(
        ShuttleUpDbContext dbContext,
        IRefundService refundService,
        IFileService fileService)
    {
        _dbContext = dbContext;
        _refundService = refundService;
        _fileService = fileService;
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

        var venueIds = await _dbContext.Venues
            .AsNoTracking()
            .Where(v => v.OwnerUserId == managerId)
            .Select(v => v.Id)
            .ToListAsync();

        if (venueIds.Count == 0)
            return Ok(Array.Empty<object>());

        var query = _dbContext.RefundRequests
            .AsNoTracking()
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .Include(r => r.Booking).ThenInclude(b => b!.BookingItems)
            .Include(r => r.Booking).ThenInclude(b => b!.Payments)
            .Include(r => r.User)
            .Include(r => r.ManagerEvidenceFile)
            .Where(r => r.Booking != null && r.Booking.VenueId != null && venueIds.Contains(r.Booking.VenueId.Value));

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            query = query.Where(r => r.Status == s);
        }

        var list = await query.OrderByDescending(r => r.RequestedAt).ToListAsync();

        var rows = list.Select(r =>
        {
            var b = r.Booking!;
            var code = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var lastPay = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            return new
            {
                refundRequestId = r.Id,
                bookingId = b.Id,
                bookingCode = code,
                bookingStatus = b.Status,
                venueName = b.Venue?.Name,
                playerName = r.User?.FullName,
                playerPhone = b.ContactPhone ?? r.User?.PhoneNumber,
                refundStatus = r.Status,
                reasonCode = r.ReasonCode,
                requestedAmount = r.RequestedAmount,
                paidAmount = r.PaidAmount,
                finalAmount = b.FinalAmount ?? b.TotalAmount,
                refundBankName = r.RefundBankName,
                refundAccountNumber = r.RefundAccountNumber,
                refundAccountHolder = r.RefundAccountHolder,
                refundQrImageUrl = r.RefundQrImageUrl,
                playerNote = r.PlayerNote,
                rejectionReason = r.RejectionReason,
                managerNote = r.ManagerNote,
                managerEvidenceUrl = r.ManagerEvidenceFile?.FileUrl,
                paymentProofUrl = lastPay?.GatewayReference,
                requestedAt = r.RequestedAt,
                processedAt = r.ProcessedAt,
            };
        });

        return Ok(rows);
    }

    public class ReconcileDto
    {
        public bool Confirmed { get; set; }
        public string? Reason { get; set; }
    }

    /// <summary>
    /// Đối soát: Manager xác nhận đã nhận CK hoặc từ chối.
    /// </summary>
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
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public class CompleteRefundDto
    {
        public string? ManagerNote { get; set; }
    }

    /// <summary>
    /// Manager đánh dấu đã CK hoàn tiền xong (upload ảnh bill qua /upload-evidence trước).
    /// </summary>
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
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Upload ảnh bill CK hoàn tiền (bằng chứng Manager đã chuyển).
    /// </summary>
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

        // Upload file to Cloudinary (stays in Controller since it needs IFormFile from HTTP context)
        var upload = await _fileService.UploadPaymentProofAsync(file, Guid.Empty, HttpContext.RequestAborted);

        var fileEntity = new ShuttleUp.DAL.Models.File
        {
            Id = Guid.NewGuid(),
            FileUrl = upload.SecureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int)file.Length,
            UploadedByUserId = managerId,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.Set<ShuttleUp.DAL.Models.File>().Add(fileEntity);
        await _dbContext.SaveChangesAsync();

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

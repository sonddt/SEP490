using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly IFileService _fileService;

    public ReportsController(ShuttleUpDbContext db, IFileService fileService)
    {
        _db = db;
        _fileService = fileService;
    }

    public record CreateReportRequest(
        string TargetType,
        Guid TargetId,
        string Reason,
        string? Description,
        List<Guid>? FileIds);

    [HttpGet("my")]
    public async Task<IActionResult> GetMyReports([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (page <= 0) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        var query = _db.ViolationReports.AsNoTracking()
            .Include(r => r.Files)
            .Where(r => r.ReporterUserId == userId);

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                id = r.Id,
                targetType = r.TargetType,
                targetId = r.TargetId,
                reason = r.Reason,
                description = r.Description,
                status = r.Status,
                adminAction = r.AdminAction,
                adminNote = r.AdminNote,
                createdAt = r.CreatedAt,
                decisionAt = r.DecisionAt,
                refundDeadlineAt = r.RefundDeadlineAt,
                fileUrls = r.Files.Select(f => f.FileUrl).ToList(),
            })
            .ToListAsync();

        return Ok(new { totalItems, totalPages, page, pageSize, items });
    }

    [HttpPost]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequest body)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var targetType = (body.TargetType ?? "").Trim().ToUpperInvariant();
        if (targetType is not ("USER" or "VENUE" or "MATCHING_POST" or "BOOKING"))
            return BadRequest(new { message = "Loại report không hợp lệ." });

        if (body.TargetId == Guid.Empty)
            return BadRequest(new { message = "Thiếu đối tượng cần report." });

        var reason = (body.Reason ?? "").Trim();
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 100)
            return BadRequest(new { message = "Vui lòng chọn lý do report hợp lệ." });

        var desc = (body.Description ?? "").Trim();
        if (desc.Length > 3000)
            return BadRequest(new { message = "Mô tả tối đa 3000 ký tự." });

        // Chặn tự báo cáo chính mình
        if (targetType == "USER" && body.TargetId == userId)
            return BadRequest(new { message = "Bạn không thể tự báo cáo chính mình." });

        // Chặn spam: chỉ 1 report PENDING cho mỗi cặp (user, target)
        var hasPending = await _db.ViolationReports.AsNoTracking()
            .AnyAsync(r => r.ReporterUserId == userId
                        && r.TargetType == targetType
                        && r.TargetId == body.TargetId
                        && r.Status == "PENDING");
        if (hasPending)
            return BadRequest(new { message = "Bạn đã gửi report cho đối tượng này rồi. Vui lòng chờ xử lý nhé." });

        var fileIds = body.FileIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? new List<Guid>();

        if (targetType == "BOOKING" && fileIds.Count == 0)
            return BadRequest(new { message = "Khiếu nại giao dịch cần đính kèm ít nhất 1 ảnh." });

        // Validate target exists (lightweight)
        switch (targetType)
        {
            case "USER":
                if (!await _db.Users.AsNoTracking().AnyAsync(u => u.Id == body.TargetId))
                    return NotFound(new { message = "Không tìm thấy người dùng này." });
                break;
            case "VENUE":
                if (!await _db.Venues.AsNoTracking().AnyAsync(v => v.Id == body.TargetId))
                    return NotFound(new { message = "Không tìm thấy cụm sân này." });
                break;
            case "MATCHING_POST":
                if (!await _db.MatchingPosts.AsNoTracking().AnyAsync(p => p.Id == body.TargetId))
                    return NotFound(new { message = "Không tìm thấy bài đăng này." });
                break;
            case "BOOKING":
                // Dispute: must be booking owner OR venue owner (manager)
                var booking = await _db.Bookings.AsNoTracking()
                    .Include(b => b.Venue)
                    .FirstOrDefaultAsync(b => b.Id == body.TargetId);
                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy booking này." });
                if (booking.UserId != userId && booking.Venue?.OwnerUserId != userId)
                    return Forbid();
                break;
        }

        // Attach files (must exist)
        var files = fileIds.Count == 0
            ? new List<DalFile>()
            : await _db.Files.Where(f => fileIds.Contains(f.Id)).ToListAsync();
        if (fileIds.Count > 0 && files.Count != fileIds.Count)
            return BadRequest(new { message = "Có ảnh đính kèm không tồn tại hoặc đã bị xóa." });

        var report = new ViolationReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = userId,
            TargetType = targetType,
            TargetId = body.TargetId,
            Reason = reason,
            Description = string.IsNullOrWhiteSpace(desc) ? null : desc,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        foreach (var f in files)
            report.Files.Add(f);

        _db.ViolationReports.Add(report);
        await _db.SaveChangesAsync();

        return Ok(new { id = report.Id, message = "Đã gửi report. Cảm ơn bạn đã giúp ShuttleUp tốt hơn." });
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

        string secureUrl;
        try
        {
            var upload = await _fileService.UploadReportAttachmentAsync(file, reportId == Guid.Empty ? Guid.NewGuid() : reportId, userId, HttpContext.RequestAborted);
            secureUrl = upload.SecureUrl;
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
        }

        var fileRow = new DalFile
        {
            Id = Guid.NewGuid(),
            FileUrl = secureUrl,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FileSize = (int?)file.Length,
            UploadedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.Files.Add(fileRow);
        await _db.SaveChangesAsync();

        return Ok(new { fileId = fileRow.Id, url = fileRow.FileUrl });
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        userId = Guid.TryParse(claim?.Value, out var id) ? id : Guid.Empty;
        return userId != Guid.Empty;
    }
}


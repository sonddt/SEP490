using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/refunds")]
[Authorize(Roles = "MANAGER")]
public class ManagerRefundsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly INotificationDispatchService _notify;
    private readonly IFileService _fileService;

    public ManagerRefundsController(
        ShuttleUpDbContext dbContext,
        INotificationDispatchService notify,
        IFileService fileService)
    {
        _dbContext = dbContext;
        _notify = notify;
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

        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Payments)
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .FirstOrDefaultAsync(r => r.Id == refundId);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            return Forbid();

        if (refund.Status != "PENDING_RECONCILIATION")
            return BadRequest(new { message = "Yêu cầu không ở trạng thái cần đối soát." });

        if (dto.Confirmed)
        {
            var paidAmount = refund.Booking!.Payments
                .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount ?? 0);

            foreach (var p in refund.Booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "COMPLETED";
                p.ConfirmedBy = managerId;
                p.ConfirmedAt = DateTime.UtcNow;
            }

            var policy = ParsePolicyOrDefault(refund.Booking.CancellationPolicySnapshotJson);
            var refundAmount = policy.ComputeRefundAmount(paidAmount);

            refund.Status = "PENDING_REFUND";
            refund.PaidAmount = paidAmount;
            refund.RequestedAmount = refundAmount;
            refund.Booking.Status = "PENDING_REFUND";

            await _dbContext.SaveChangesAsync();

            if (refund.UserId.HasValue)
            {
                var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(
                    refund.UserId.Value,
                    NotificationTypes.RefundReconciled,
                    "Chủ sân đã xác nhận nhận tiền",
                    $"Đơn #{code}: Chủ sân đã xác nhận nhận được chuyển khoản. Hoàn tiền đang xử lý.",
                    new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                    sendEmail: false,
                    cancellationToken: HttpContext.RequestAborted);
            }

            return Ok(new { message = "Đã xác nhận nhận tiền. Đơn chuyển sang chờ hoàn tiền.", status = "PENDING_REFUND" });
        }
        else
        {
            refund.Status = "REJECTED";
            refund.RejectionReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Không nhận được chuyển khoản." : dto.Reason.Trim();
            refund.ProcessedBy = managerId;
            refund.ProcessedAt = DateTime.UtcNow;
            refund.Booking!.Status = "CANCELLED";

            foreach (var item in refund.Booking.BookingItems ?? Enumerable.Empty<BookingItem>())
                item.Status = "CANCELLED";
            foreach (var p in refund.Booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";

            await _dbContext.SaveChangesAsync();

            if (refund.UserId.HasValue)
            {
                var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
                await _notify.NotifyUserAsync(
                    refund.UserId.Value,
                    NotificationTypes.RefundRejected,
                    "Yêu cầu hoàn tiền bị từ chối",
                    $"Đơn #{code}: {refund.RejectionReason}",
                    new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                    sendEmail: false,
                    cancellationToken: HttpContext.RequestAborted);
            }

            return Ok(new { message = "Đã từ chối. Đơn chuyển sang Đã hủy.", status = "REJECTED" });
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

        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .FirstOrDefaultAsync(r => r.Id == refundId);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            return Forbid();

        if (refund.Status != "PENDING_REFUND")
            return BadRequest(new { message = "Yêu cầu không ở trạng thái chờ hoàn tiền." });

        if (refund.ManagerEvidenceFileId == null)
            return BadRequest(new { message = "Oops… Bạn cần tải ảnh biên lai chuyển khoản hoàn tiền trước khi đánh dấu hoàn tất." });

        refund.Status = "COMPLETED";
        refund.ProcessedBy = managerId;
        refund.ProcessedAt = DateTime.UtcNow;
        refund.ManagerNote = dto?.ManagerNote?.Trim();
        refund.Booking!.Status = "REFUNDED";

        if (refund.Booking.SeriesId is { } sid)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == sid);
            if (series != null) series.Status = "REFUNDED";
        }

        await _dbContext.SaveChangesAsync();

        if (refund.UserId.HasValue)
        {
            var code = "SU" + refund.Booking.Id.ToString("N")[^6..].ToUpperInvariant();
            await _notify.NotifyUserAsync(
                refund.UserId.Value,
                NotificationTypes.RefundCompleted,
                "Hoàn tiền thành công",
                $"Đơn #{code}: Chủ sân đã chuyển khoản hoàn tiền {(refund.RequestedAmount ?? 0).ToString("N0")} ₫. Vui lòng kiểm tra tài khoản.",
                new { bookingId = refund.BookingId, entityType = "refund", deepLink = "/user/bookings" },
                sendEmail: true,
                cancellationToken: HttpContext.RequestAborted);
        }

        return Ok(new { message = "Đã hoàn tất hoàn tiền.", status = "COMPLETED" });
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

        var refund = await _dbContext.RefundRequests
            .Include(r => r.Booking).ThenInclude(b => b!.Venue)
            .FirstOrDefaultAsync(r => r.Id == refundId);

        if (refund?.Booking?.Venue?.OwnerUserId != managerId)
            return Forbid();

        var upload = await _fileService.UploadPaymentProofAsync(file, refund.BookingId ?? Guid.Empty, HttpContext.RequestAborted);

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

        refund.ManagerEvidenceFileId = fileEntity.Id;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Đã tải ảnh bill CK hoàn tiền.", fileUrl = upload.SecureUrl });
    }

    private static CancellationPolicySnapshot ParsePolicyOrDefault(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new CancellationPolicySnapshot();
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<CancellationPolicySnapshot>(json)
                   ?? new CancellationPolicySnapshot();
        }
        catch
        {
            return new CancellationPolicySnapshot();
        }
    }
}

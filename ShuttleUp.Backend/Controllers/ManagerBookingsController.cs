using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/bookings")]
[Authorize(Roles = "MANAGER")]
public class ManagerBookingsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;

    public ManagerBookingsController(ShuttleUpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        var s = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(s, out userId);
    }

    public class ManagerBookingStatusPatchDto
    {
        public string Status { get; set; } = null!;
        public string? Reason { get; set; }
    }

    /// <summary>
    /// Đặt sân tại các venue do manager hiện tại sở hữu.
    /// </summary>
    /// <param name="status">Tuỳ chọn: PENDING | CONFIRMED | CANCELLED (theo cột bookings.status).</param>
    [HttpGet]
    public async Task<IActionResult> GetBookings([FromQuery] string? status)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var query = _dbContext.Bookings
            .AsNoTracking()
            .AsSplitQuery()
            .Include(b => b.Venue)
            .Include(b => b.User)!.ThenInclude(u => u!.AvatarFile)
            .Include(b => b.BookingItems).ThenInclude(bi => bi.Court)!.ThenInclude(c => c!.Files)
            .Include(b => b.Payments)
            .Where(b => b.Venue != null && b.Venue.OwnerUserId == userId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToUpperInvariant();
            query = s switch
            {
                "PENDING" or "CONFIRMED" or "CANCELLED" => query.Where(b => b.Status == s),
                _ => query
            };
        }

        var list = await query
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        var rows = list.Select(b =>
        {
            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var payment = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            var paymentStatus = payment?.Status?.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true
                ? "PAID"
                : "UNPAID";

            var items = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi =>
            {
                var court = bi.Court;
                var img = court?.Files?.FirstOrDefault()?.FileUrl;
                return new
                {
                    courtName = court?.Name,
                    courtImageUrl = img,
                    startTime = bi.StartTime,
                    endTime = bi.EndTime
                };
            }).ToList();

            return new
            {
                bookingId = b.Id,
                bookingCode,
                status = b.Status,
                contactName = b.ContactName,
                contactPhone = b.ContactPhone,
                guestNote = b.GuestNote,
                totalAmount = b.FinalAmount ?? b.TotalAmount,
                venueName = b.Venue?.Name,
                venueAddress = b.Venue?.Address,
                playerName = b.User?.FullName,
                playerPhone = b.ContactPhone ?? b.User?.PhoneNumber,
                playerAvatarUrl = b.User?.AvatarFile?.FileUrl,
                paymentStatus,
                paymentMethod = payment?.Method,
                proofUrl = payment?.GatewayReference,
                createdAt = b.CreatedAt,
                items
            };
        });

        return Ok(rows);
    }

    /// <summary>
    /// Duyệt hoặc từ chối đơn đặt sân.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> PatchStatus([FromRoute] Guid id, [FromBody] ManagerBookingStatusPatchDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
            return BadRequest(new { message = "Thiếu trạng thái." });

        var next = dto.Status.Trim().ToUpperInvariant();
        if (next is not ("CONFIRMED" or "CANCELLED"))
            return BadRequest(new { message = "Trạng thái không hợp lệ (CONFIRMED | CANCELLED)." });

        var booking = await _dbContext.Bookings
            .Include(b => b.Venue)
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Venue?.OwnerUserId != userId)
            return Forbid();

        if (booking.Status == "CANCELLED")
            return BadRequest(new { message = "Đơn đã bị huỷ." });

        if (next == "CONFIRMED")
        {
            if (booking.Status != "PENDING")
                return BadRequest(new { message = "Chỉ có thể duyệt đơn đang chờ." });

            booking.Status = "CONFIRMED";
            foreach (var item in booking.BookingItems)
                item.Status = "CONFIRMED";

            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "COMPLETED";
                p.ConfirmedBy = userId;
                p.ConfirmedAt = DateTime.UtcNow;
            }
        }
        else
        {
            if (booking.Status != "PENDING" && booking.Status != "CONFIRMED")
                return BadRequest(new { message = "Không thể huỷ đơn ở trạng thái này." });

            booking.Status = "CANCELLED";
            foreach (var item in booking.BookingItems)
                item.Status = "CANCELLED";

            foreach (var p in booking.Payments.Where(p =>
                         p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
            {
                p.Status = "CANCELLED";
            }
        }

        await _dbContext.SaveChangesAsync();

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
        return Ok(new
        {
            bookingId = booking.Id,
            bookingCode = code,
            booking.Status,
            reason = dto.Reason
        });
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/bookings")]
[Authorize(Roles = "MANAGER")]
public class ManagerBookingsController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IManagerBookingService _managerBookingService;

    public ManagerBookingsController(
        ShuttleUpDbContext dbContext,
        IManagerBookingService managerBookingService)
    {
        _dbContext = dbContext;
        _managerBookingService = managerBookingService;
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
            .Where(b => b.Venue != null && b.Venue.OwnerUserId == userId && b.Status != "HOLDING");

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
                seriesId = b.SeriesId,
                isLongTerm = b.SeriesId != null,
                contactName = b.ContactName,
                contactPhone = b.ContactPhone,
                guestNote = b.GuestNote,
                managerStatusNote = b.ManagerStatusNote,
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

        try
        {
            var result = await _managerBookingService.PatchStatusAsync(id, userId, dto.Status, dto.Reason, HttpContext.RequestAborted);
            return Ok(new
            {
                bookingId = result.BookingId,
                bookingCode = result.BookingCode,
                status = result.Status,
                reason = result.Reason,
                managerStatusNote = result.ManagerStatusNote,
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
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
}

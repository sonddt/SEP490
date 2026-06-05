using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/bookings")]
[Authorize(Roles = "MANAGER")]
public class ManagerBookingsController : ControllerBase
{
    private readonly IManagerBookingService _managerBookingService;

    public ManagerBookingsController(IManagerBookingService managerBookingService)
    {
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

    [HttpGet]
    public async Task<IActionResult> GetBookings([FromQuery] string? status)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var rows = await _managerBookingService.GetBookingsAsync(userId, status, HttpContext.RequestAborted);
        return Ok(rows);
    }

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
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}

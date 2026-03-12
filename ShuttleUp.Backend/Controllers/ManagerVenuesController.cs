using System.IdentityModel.Tokens.Jwt;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/manager/venues")]
[Authorize(Roles = "MANAGER")]
public class ManagerVenuesController : ControllerBase
{
    private readonly IVenueService _venueService;
    private readonly ICourtService _courtService;

    public ManagerVenuesController(IVenueService venueService, ICourtService courtService)
    {
        _venueService = venueService;
        _courtService = courtService;
    }

    // =====================================================================
    // VENUE CRUD
    // =====================================================================

    /// <summary>
    /// Tạo mới venue do manager hiện tại quản lý.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AddVenue([FromBody] ManagerVenueUpsertDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = new Venue
        {
            OwnerUserId = managerId,
            Name = request.Name,
            Address = request.Address,
            Lat = request.Lat,
            Lng = request.Lng
        };

        await _venueService.CreateAsync(venue);

        return CreatedAtAction(nameof(GetManagedVenues), new { id = venue.Id }, new
        {
            venue.Id,
            venue.Name,
            venue.Address,
            venue.ApprovalStatus,
            venue.IsActive,
            venue.CreatedAt
        });
    }

    /// <summary>
    /// Cập nhật thông tin venue do manager quản lý.
    /// </summary>
    [HttpPut("{venueId:guid}")]
    public async Task<IActionResult> EditVenue([FromRoute] Guid venueId, [FromBody] ManagerVenueUpsertDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền chỉnh sửa venue này.");

        venue.Name = request.Name;
        venue.Address = request.Address;
        venue.Lat = request.Lat;
        venue.Lng = request.Lng;

        await _venueService.UpdateAsync(venue);

        return Ok(new
        {
            venue.Id,
            venue.Name,
            venue.Address,
            venue.ApprovalStatus,
            venue.IsActive,
            venue.CreatedAt
        });
    }

    /// <summary>
    /// Xóa venue do manager quản lý.
    /// Lưu ý: courts và các dữ liệu liên quan sẽ bị xóa theo constraint DB (ON DELETE CASCADE).
    /// </summary>
    [HttpDelete("{venueId:guid}")]
    public async Task<IActionResult> DeleteVenue([FromRoute] Guid venueId)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền xóa venue này.");

        await _venueService.DeleteAsync(venueId);
        return NoContent();
    }

    /// <summary>
    /// Danh sách venue mà manager hiện tại quản lý, hỗ trợ search + sort + phân trang.
    /// </summary>
    /// <param name="search">Từ khóa tìm kiếm theo tên hoặc địa chỉ.</param>
    /// <param name="sortBy">Trường sắp xếp: name | createdAt (mặc định: createdAt).</param>
    /// <param name="sortDir">Hướng sắp xếp: asc | desc (mặc định: desc).</param>
    /// <param name="page">Trang hiện tại (>=1, mặc định: 1).</param>
    /// <param name="pageSize">Số item mỗi trang (mặc định: 20, tối đa: 100).</param>
    [HttpGet]
    public async Task<IActionResult> GetManagedVenues(
        [FromQuery] string? search,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDir,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var venues = await _venueService.GetByOwnerAsync(managerId);

        // Search
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            venues = venues.Where(v =>
                (!string.IsNullOrEmpty(v.Name) &&
                 v.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(v.Address) &&
                 v.Address.Contains(keyword, StringComparison.OrdinalIgnoreCase)));
        }

        // Sort
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "createdAt" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "desc" : sortDir.Trim().ToLowerInvariant();

        venues = (sortBy, sortDir) switch
        {
            ("name", "asc") => venues.OrderBy(v => v.Name),
            ("name", "desc") => venues.OrderByDescending(v => v.Name),
            ("createdat", "asc") => venues.OrderBy(v => v.CreatedAt),
            ("createdat", "desc") => venues.OrderByDescending(v => v.CreatedAt),
            _ => venues.OrderByDescending(v => v.CreatedAt)
        };

        var totalItems = venues.Count();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = venues
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.ApprovalStatus,
                v.IsActive,
                v.CreatedAt
            })
            .ToList();

        return Ok(new
        {
            totalItems,
            totalPages,
            page,
            pageSize,
            items
        });
    }

    // =====================================================================
    // COURT CRUD + LIST
    // =====================================================================

    /// <summary>
    /// Thêm court mới vào venue do manager quản lý.
    /// </summary>
    [HttpPost("{venueId:guid}/courts")]
    public async Task<IActionResult> AddCourt(
        [FromRoute] Guid venueId,
        [FromBody] ManagerCourtUpsertDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền thêm court cho venue này.");

        var court = new Court
        {
            VenueId = venueId,
            Name = request.Name,
            SportType = request.SportType,
            IsActive = request.IsActive ?? true
        };

        await _courtService.CreateAsync(court);

        return Ok(new
        {
            court.Id,
            court.Name,
            court.SportType,
            court.IsActive,
            court.VenueId
        });
    }

    /// <summary>
    /// Chỉnh sửa court trong venue do manager quản lý.
    /// </summary>
    [HttpPut("{venueId:guid}/courts/{courtId:guid}")]
    public async Task<IActionResult> EditCourt(
        [FromRoute] Guid venueId,
        [FromRoute] Guid courtId,
        [FromBody] ManagerCourtUpsertDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền chỉnh sửa court cho venue này.");

        var court = await _courtService.GetByIdAsync(courtId);
        if (court == null || court.VenueId != venueId)
            return NotFound(new { message = "Court không tồn tại trong venue này." });

        court.Name = request.Name;
        court.SportType = request.SportType;
        if (request.IsActive.HasValue)
            court.IsActive = request.IsActive;

        await _courtService.UpdateAsync(court);

        return Ok(new
        {
            court.Id,
            court.Name,
            court.SportType,
            court.IsActive,
            court.VenueId
        });
    }

    /// <summary>
    /// Xóa court trong venue do manager quản lý.
    /// </summary>
    [HttpDelete("{venueId:guid}/courts/{courtId:guid}")]
    public async Task<IActionResult> DeleteCourt(
        [FromRoute] Guid venueId,
        [FromRoute] Guid courtId)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền xóa court cho venue này.");

        var court = await _courtService.GetByIdAsync(courtId);
        if (court == null || court.VenueId != venueId)
            return NotFound(new { message = "Court không tồn tại trong venue này." });

        await _courtService.DeleteAsync(courtId);

        return NoContent();
    }

    /// <summary>
    /// Danh sách court của một venue mà manager đang quản lý, hỗ trợ search + sort + phân trang.
    /// </summary>
    /// <param name="venueId">Id của venue.</param>
    /// <param name="search">Từ khóa tìm kiếm theo tên hoặc loại môn thể thao.</param>
    /// <param name="sortBy">Trường sắp xếp: name | sportType | isActive (mặc định: name).</param>
    /// <param name="sortDir">Hướng sắp xếp: asc | desc (mặc định: asc).</param>
    /// <param name="page">Trang hiện tại (>=1, mặc định: 1).</param>
    /// <param name="pageSize">Số item mỗi trang (mặc định: 20, tối đa: 100).</param>
    [HttpGet("{venueId:guid}/courts")]
    public async Task<IActionResult> GetCourtsInVenue(
        [FromRoute] Guid venueId,
        [FromQuery] string? search,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDir,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền truy cập venue này.");

        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var courts = await _courtService.GetByVenueAsync(venueId);

        // Search
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            courts = courts.Where(c =>
                (!string.IsNullOrEmpty(c.Name) &&
                 c.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(c.SportType) &&
                 c.SportType.Contains(keyword, StringComparison.OrdinalIgnoreCase)));
        }

        // Sort
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "name" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();

        courts = (sortBy, sortDir) switch
        {
            ("name", "asc") => courts.OrderBy(c => c.Name),
            ("name", "desc") => courts.OrderByDescending(c => c.Name),
            ("sporttype", "asc") => courts.OrderBy(c => c.SportType),
            ("sporttype", "desc") => courts.OrderByDescending(c => c.SportType),
            ("isactive", "asc") => courts.OrderBy(c => c.IsActive),
            ("isactive", "desc") => courts.OrderByDescending(c => c.IsActive),
            _ => courts.OrderBy(c => c.Name)
        };

        var totalItems = courts.Count();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var items = courts
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.SportType,
                c.IsActive,
                c.VenueId
            })
            .ToList();

        return Ok(new
        {
            totalItems,
            totalPages,
            page,
            pageSize,
            items
        });
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                          User.FindFirst(ClaimTypes.NameIdentifier);

        return Guid.TryParse(userIdClaim?.Value, out var id) ? id : Guid.Empty;
    }
}


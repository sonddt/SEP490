using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// Public/player-facing APIs for browsing venues.
/// Chỉ trả về các venue đã được admin duyệt và đang hoạt động.
/// </summary>
[ApiController]
[Route("api/venues")]
public class VenuesController : ControllerBase
{
    private readonly ShuttleUpDbContext _dbContext;

    public VenuesController(ShuttleUpDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Lấy chi tiết một venue (dùng cho trang VenueDetails).
    /// Chỉ trả về nếu venue đã APPROVED và đang hoạt động.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVenueById([FromRoute] Guid id)
    {
        var venue = await _dbContext.Venues
            .Where(v => v.Id == id && v.ApprovalStatus == "APPROVED" && v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.Lat,
                v.Lng,
                OwnerName = v.OwnerUser != null ? v.OwnerUser.FullName : null,
                OwnerEmail = v.OwnerUser != null ? v.OwnerUser.Email : null,
                OwnerPhone = v.OwnerUser != null ? v.OwnerUser.PhoneNumber : null,
                // Giá min/max để hiển thị "12k - 30k /giờ"
                MinPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Min(cp => (decimal?)cp.Price),
                MaxPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Max(cp => (decimal?)cp.Price),
                Rating = 5.0,
                ReviewCount = 0
            })
            .FirstOrDefaultAsync();

        if (venue == null)
            return NotFound();

        return Ok(venue);
    }

    /// <summary>
    /// Danh sách venues cho player.
    /// Chỉ bao gồm venues APPROVED + IsActive = true.
    /// Hỗ trợ sort theo giá min tăng dần / giảm dần.
    /// </summary>
    /// <param name="sortBy">Trường sắp xếp: price (mặc định: price).</param>
    /// <param name="sortDir">Hướng sắp xếp: asc | desc (mặc định: asc).</param>
    [HttpGet]
    public async Task<IActionResult> GetApprovedVenues(
        [FromQuery] string? sortBy = "price",
        [FromQuery] string? sortDir = "asc")
    {
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "price" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();

        // Lấy venues đã APPROVED + đang hoạt động cùng với min/max price (nếu có)
        var baseQuery = _dbContext.Venues
            .Where(v => v.ApprovalStatus == "APPROVED" && v.IsActive == true)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Address,
                v.Lat,
                v.Lng,
                // Giá thấp nhất và cao nhất trong tất cả court thuộc venue (cả weekday & weekend)
                MinPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Min(cp => (decimal?)cp.Price), // null nếu chưa cấu hình giá
                MaxPrice = v.Courts
                    .SelectMany(c => c.CourtPrices)
                    .Max(cp => (decimal?)cp.Price)
            });

        IOrderedQueryable<dynamic> ordered;

        if (sortBy == "price")
        {
            // Sắp xếp theo MinPrice, venues chưa có giá sẽ luôn xuống cuối.
            ordered = sortDir == "desc"
                ? baseQuery.OrderByDescending(v => v.MinPrice.HasValue)
                           .ThenByDescending(v => v.MinPrice)
                : baseQuery.OrderByDescending(v => v.MinPrice.HasValue)
                           .ThenBy(v => v.MinPrice);
        }
        else
        {
            // Fallback theo tên
            ordered = sortDir == "desc"
                ? baseQuery.OrderByDescending(v => v.Name)
                : baseQuery.OrderBy(v => v.Name);
        }

        var items = await ordered.ToListAsync();

        return Ok(items);
    }
}


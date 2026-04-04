using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// API công khai: danh sách bài Nổi bật đang hiển thị.
/// </summary>
[ApiController]
[Route("api/featured-posts")]
[AllowAnonymous]
public class FeaturedPostsController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;

    public FeaturedPostsController(ShuttleUpDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Bài đã xuất bản và nằm trong khung thời gian hiển thị.
    /// Dùng giờ cục bộ để so khớp kiểu DATETIME của MySQL (không offset).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPublished()
    {
        var now = DateTime.Now;

        var items = await _db.FeaturedPosts
            .AsNoTracking()
            .Where(p => p.IsPublished
                        && (p.DisplayFrom == null || p.DisplayFrom <= now)
                        && (p.DisplayUntil == null || p.DisplayUntil >= now))
            .OrderByDescending(p => p.SortOrder)
            .ThenByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Excerpt,
                p.Body,
                p.CoverImageUrl,
                p.LinkUrl,
                p.DisplayFrom,
                p.DisplayUntil,
                p.SortOrder,
                p.AuthorRole,
                p.VenueId,
                VenueName = p.Venue != null ? p.Venue.Name : (string?)null,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }
}

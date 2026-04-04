using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.DTOs.Featured;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

[ApiController]
[Route("api/admin/featured-posts")]
[Authorize(Roles = "ADMIN")]
public class AdminFeaturedPostsController : ControllerBase
{
    private readonly ShuttleUpDbContext _db;
    private readonly IFileService _fileService;

    public AdminFeaturedPostsController(ShuttleUpDbContext db, IFileService fileService)
    {
        _db = db;
        _fileService = fileService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var list = await _db.FeaturedPosts
            .AsNoTracking()
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
                p.IsPublished,
                p.DisplayFrom,
                p.DisplayUntil,
                p.SortOrder,
                p.AuthorRole,
                p.AuthorUserId,
                AuthorName = p.AuthorUser.FullName,
                p.VenueId,
                VenueName = p.Venue != null ? p.Venue.Name : (string?)null,
                p.CreatedAt,
                p.UpdatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FeaturedPostUpsertDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Tiêu đề không được để trống." });

        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return Unauthorized();

        if (dto.VenueId.HasValue)
        {
            var vExists = await _db.Venues.AnyAsync(v => v.Id == dto.VenueId.Value);
            if (!vExists)
                return BadRequest(new { message = "Cụm sân không tồn tại." });
        }

        var now = DateTime.UtcNow;
        var post = new FeaturedPost
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            Excerpt = string.IsNullOrWhiteSpace(dto.Excerpt) ? null : dto.Excerpt.Trim(),
            Body = string.IsNullOrWhiteSpace(dto.Body) ? null : dto.Body.Trim(),
            CoverImageUrl = string.IsNullOrWhiteSpace(dto.CoverImageUrl) ? null : dto.CoverImageUrl.Trim(),
            LinkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : dto.LinkUrl.Trim(),
            IsPublished = dto.IsPublished,
            DisplayFrom = dto.DisplayFrom,
            DisplayUntil = dto.DisplayUntil,
            SortOrder = dto.SortOrder,
            AuthorUserId = userId,
            AuthorRole = "ADMIN",
            VenueId = dto.VenueId,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.FeaturedPosts.Add(post);
        await _db.SaveChangesAsync();

        return Ok(new { post.Id, message = "Đã tạo bài đăng." });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] FeaturedPostUpsertDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Tiêu đề không được để trống." });

        var post = await _db.FeaturedPosts.FirstOrDefaultAsync(p => p.Id == id);
        if (post == null)
            return NotFound(new { message = "Không tìm thấy bài đăng." });

        if (dto.VenueId.HasValue)
        {
            var vExists = await _db.Venues.AnyAsync(v => v.Id == dto.VenueId.Value);
            if (!vExists)
                return BadRequest(new { message = "Cụm sân không tồn tại." });
        }

        post.Title = dto.Title.Trim();
        post.Excerpt = string.IsNullOrWhiteSpace(dto.Excerpt) ? null : dto.Excerpt.Trim();
        post.Body = string.IsNullOrWhiteSpace(dto.Body) ? null : dto.Body.Trim();
        post.CoverImageUrl = string.IsNullOrWhiteSpace(dto.CoverImageUrl) ? null : dto.CoverImageUrl.Trim();
        post.LinkUrl = string.IsNullOrWhiteSpace(dto.LinkUrl) ? null : dto.LinkUrl.Trim();
        post.IsPublished = dto.IsPublished;
        post.DisplayFrom = dto.DisplayFrom;
        post.DisplayUntil = dto.DisplayUntil;
        post.SortOrder = dto.SortOrder;
        post.VenueId = dto.VenueId;
        post.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật." });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id)
    {
        var post = await _db.FeaturedPosts.FirstOrDefaultAsync(p => p.Id == id);
        if (post == null)
            return NotFound();

        _db.FeaturedPosts.Remove(post);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("upload-image")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        var adminId = GetCurrentUserId();
        if (adminId == Guid.Empty)
            return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không có file ảnh." });

        var result = await _fileService.UploadFeaturedPostImageAsync(file, adminId, HttpContext.RequestAborted);
        return Ok(new { url = result.SecureUrl });
    }

    private Guid GetCurrentUserId()
    {
        var c = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(c?.Value, out var id) ? id : Guid.Empty;
    }
}

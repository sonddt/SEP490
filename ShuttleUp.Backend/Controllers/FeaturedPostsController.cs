using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.Backend.Controllers;

/// <summary>
/// API công khai: danh sách bài Nổi bật đang hiển thị.
/// </summary>
[ApiController]
[Route("api/featured-posts")]
[AllowAnonymous]
public class FeaturedPostsController : ControllerBase
{
    private readonly IFeaturedPostService _featuredPostService;

    public FeaturedPostsController(IFeaturedPostService featuredPostService)
    {
        _featuredPostService = featuredPostService;
    }

    /// <summary>
    /// Bài đã xuất bản và nằm trong khung thời gian hiển thị.
    /// Thứ tự: bài tạo mới nhất lên trước (created_at giảm dần).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPublished()
    {
        var items = await _featuredPostService.GetPublishedAsync();
        return Ok(items);
    }
}

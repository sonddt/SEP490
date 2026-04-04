using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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
    private readonly ShuttleUpDbContext _dbContext;
    private readonly IConfiguration _config;

    public ManagerVenuesController(
        IVenueService venueService,
        ICourtService courtService,
        ShuttleUpDbContext dbContext,
        IConfiguration config)
    {
        _venueService = venueService;
        _courtService = courtService;
        _dbContext = dbContext;
        _config = config;
    }

    public class CourtStatusUpdateDto
    {
        public bool IsActive { get; set; }
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

        if (request.Lat.HasValue && (request.Lat.Value < -90 || request.Lat.Value > 90))
            return BadRequest(new { message = "Vĩ độ (Latitude) phải nằm trong khoảng -90 đến 90." });

        if (request.Lng.HasValue && (request.Lng.Value < -180 || request.Lng.Value > 180))
            return BadRequest(new { message = "Kinh độ (Longitude) phải nằm trong khoảng -180 đến 180." });

        var venue = new Venue
        {
            OwnerUserId = managerId,
            Name = request.Name,
            Address = request.Address,
            Lat = request.Lat,
            Lng = request.Lng,
            ContactName = request.ContactName,
            ContactPhone = request.ContactPhone,
            WeeklyDiscountPercent = request.WeeklyDiscountPercent,
            MonthlyDiscountPercent = request.MonthlyDiscountPercent
        };

        await _venueService.CreateAsync(venue);

        return CreatedAtAction(nameof(GetManagedVenues), new { id = venue.Id }, new
        {
            venue.Id,
            venue.Name,
            venue.Address,
            venue.ContactName,
            venue.ContactPhone,
            venue.IsActive,
            venue.CreatedAt
        });
    }

    /// <summary>
    /// Cập nhật thông tin venue do manager quản lý.
    /// </summary>
    [HttpPut("{venueId}")]
    public async Task<IActionResult> EditVenue([FromRoute] Guid venueId, [FromBody] ManagerVenueUpsertDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        if (request.Lat.HasValue && (request.Lat.Value < -90 || request.Lat.Value > 90))
            return BadRequest(new { message = "Vĩ độ (Latitude) phải nằm trong khoảng -90 đến 90." });

        if (request.Lng.HasValue && (request.Lng.Value < -180 || request.Lng.Value > 180))
            return BadRequest(new { message = "Kinh độ (Longitude) phải nằm trong khoảng -180 đến 180." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền chỉnh sửa venue này.");

        venue.Name = request.Name;
        venue.Address = request.Address;
        venue.Lat = request.Lat;
        venue.Lng = request.Lng;
        venue.ContactName = request.ContactName;
        venue.ContactPhone = request.ContactPhone;
        venue.WeeklyDiscountPercent = request.WeeklyDiscountPercent;
        venue.MonthlyDiscountPercent = request.MonthlyDiscountPercent;

        await _venueService.UpdateAsync(venue);

        return Ok(new
        {
            venue.Id,
            venue.Name,
            venue.Address,
            venue.ContactName,
            venue.ContactPhone,
            venue.IsActive,
            venue.CreatedAt
        });
    }

    /// <summary>
    /// Xóa venue do manager quản lý.
    /// Lưu ý: courts và các dữ liệu liên quan sẽ bị xóa theo constraint DB (ON DELETE CASCADE).
    /// </summary>
    [HttpDelete("{venueId}")]
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
    /// Publish (Công khai) venue cho người dùng đặt lịch.
    /// </summary>
    [HttpPut("{venueId}/publish")]
    public async Task<IActionResult> PublishVenue([FromRoute] Guid venueId)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền thao tác trên venue này.");

        // Validation 1: Có ít nhất 1 sân active
        var hasActiveCourt = await _dbContext.Courts
            .AnyAsync(c => c.VenueId == venueId && c.IsActive == true && c.Status == "ACTIVE");
        if (!hasActiveCourt)
            return BadRequest(new { message = "Venue phải có ít nhất 1 sân đang hoạt động (ACTIVE) trước khi publish." });

        // Validation 2: Có cấu hình giá (Fix query for lazy loading nulls)
        var hasPricing = await _dbContext.CourtPrices
            .Include(cp => cp.Court)
            .AnyAsync(cp => cp.Court != null && cp.Court.VenueId == venueId);
        if (!hasPricing)
            return BadRequest(new { message = "Venue phải cấu hình giá sân (CourtPrices) trước khi publish." });

        // Validation 3: Có cấu hình giờ mở cửa (VenueOpenHours hoặc CourtOpenHours)
        var hasVenueHours = await _dbContext.VenueOpenHours.AnyAsync(voh => voh.VenueId == venueId);
        var hasCourtHours = await _dbContext.CourtOpenHours
            .Include(coh => coh.Court)
            .AnyAsync(coh => coh.Court != null && coh.Court.VenueId == venueId);
        
        if (!hasVenueHours && !hasCourtHours)
            return BadRequest(new { message = "Venue phải cấu hình giờ mở cửa trước khi publish." });

        venue.IsActive = true;
        await _venueService.UpdateAsync(venue);

        return Ok(new { message = "Publish trạng thái thành công.", isActive = true });
    }

    /// <summary>
    /// Unpublish (Ẩn) venue tạm thời. Option A: Không cho phép nếu đang có booking future.
    /// </summary>
    [HttpPut("{venueId}/unpublish")]
    public async Task<IActionResult> UnpublishVenue([FromRoute] Guid venueId)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền thao tác trên venue này.");

        // Validate: Không cho unpublish nếu có booking trong tương lai chưa hoàn thành
        var now = DateTime.UtcNow;
        var hasFutureBookings = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .AnyAsync(b => b.VenueId == venueId 
                           && b.Status != "CANCELLED" 
                           && b.Status != "COMPLETED"
                           && b.BookingItems.Any(bi => bi.StartTime > now));

        if (hasFutureBookings)
            return BadRequest(new { message = "Không thể unpublish. Cụm sân đang có lịch đặt ở tương lai." });

        venue.IsActive = false;
        await _venueService.UpdateAsync(venue);

        return Ok(new { message = "Unpublish trạng thái thành công.", isActive = false });
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
    [HttpPost("{venueId}/courts")]
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

        // Tạo court mới
        var court = new Court
        {
            VenueId = venueId,
            Name = request.Name,
            GroupName = request.GroupName,
            Status = request.Status,
            Surface = request.Surface,
            MaxGuest = request.MaxGuests,
            Description = request.Description,
            IsActive = request.IsActive ?? true
        };

        await _courtService.CreateAsync(court); // lưu vào bảng courts

        // Nếu có cấu hình giá theo khung giờ thì thêm vào court_prices
        if (request.PriceSlots is { Count: > 0 })
        {
            var priceEntities = new List<CourtPrice>();

            foreach (var slot in request.PriceSlots)
            {
                if (!TimeOnly.TryParse(slot.StartTime, out var start) ||
                    !TimeOnly.TryParse(slot.EndTime, out var end))
                {
                    return BadRequest(new { message = "StartTime/EndTime phải có định dạng HH:mm." });
                }

                if (start >= end)
                {
                    return BadRequest(new { message = "StartTime phải nhỏ hơn EndTime trong cùng một ngày." });
                }

                priceEntities.Add(new CourtPrice
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    StartTime = start,
                    EndTime = end,
                    Price = slot.Price,
                    IsWeekend = slot.IsWeekend
                });
            }

            if (priceEntities.Count > 0)
            {
                _dbContext.CourtPrices.AddRange(priceEntities);
                await _dbContext.SaveChangesAsync();
            }
        }

        // Lưu open hours theo từng ngày
        if (request.OpenHours is { Count: > 0 })
        {
            var openEntities = new List<CourtOpenHour>();
            foreach (var day in request.OpenHours)
            {
                if (!day.Enabled)
                {
                    openEntities.Add(new CourtOpenHour
                    {
                        Id = Guid.NewGuid(),
                        CourtId = court.Id,
                        DayOfWeek = day.DayOfWeek,
                        OpenTime = null,
                        CloseTime = null
                    });
                    continue;
                }

                if (string.IsNullOrWhiteSpace(day.OpenTime) || string.IsNullOrWhiteSpace(day.CloseTime))
                    return BadRequest(new { message = "OpenHours: Khi Enabled=true phải cung cấp OpenTime/CloseTime (HH:mm)." });

                if (!TimeOnly.TryParse(day.OpenTime, out var open) ||
                    !TimeOnly.TryParse(day.CloseTime, out var close))
                    return BadRequest(new { message = "OpenHours: OpenTime/CloseTime phải có định dạng HH:mm." });

                if (open >= close)
                    return BadRequest(new { message = "OpenHours: OpenTime phải nhỏ hơn CloseTime cho cùng một ngày." });

                openEntities.Add(new CourtOpenHour
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    DayOfWeek = day.DayOfWeek,
                    OpenTime = open,
                    CloseTime = close
                });
            }

            if (openEntities.Count > 0)
            {
                _dbContext.CourtOpenHours.AddRange(openEntities);
                await _dbContext.SaveChangesAsync();
            }
        }

        return Ok(new
        {
            court.Id,
            court.Name,
            court.Status,
            court.Surface,
            court.MaxGuest,
            court.Description,
            court.IsActive,
            court.VenueId
        });
    }

    /// <summary>
    /// Chỉnh sửa court trong venue do manager quản lý.
    /// </summary>
    [HttpPut("{venueId}/courts/{courtId}")]
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
        court.GroupName = request.GroupName;
        court.Status = request.Status;
        court.Surface = request.Surface;
        court.MaxGuest = request.MaxGuests;
        court.Description = request.Description;
        if (request.IsActive.HasValue)
            court.IsActive = request.IsActive;

        await _courtService.UpdateAsync(court);

        // Replace court_prices based on request
        var oldPrices = _dbContext.CourtPrices.Where(cp => cp.CourtId == court.Id);
        _dbContext.CourtPrices.RemoveRange(oldPrices);

        if (request.PriceSlots is { Count: > 0 })
        {
            var priceEntities = new List<CourtPrice>();
            foreach (var slot in request.PriceSlots)
            {
                if (!TimeOnly.TryParse(slot.StartTime, out var start) ||
                    !TimeOnly.TryParse(slot.EndTime, out var end))
                {
                    return BadRequest(new { message = "StartTime/EndTime phải có định dạng HH:mm." });
                }

                if (start >= end)
                {
                    return BadRequest(new { message = "StartTime phải nhỏ hơn EndTime trong cùng một ngày." });
                }

                priceEntities.Add(new CourtPrice
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    StartTime = start,
                    EndTime = end,
                    Price = slot.Price,
                    IsWeekend = slot.IsWeekend
                });
            }

            if (priceEntities.Count > 0)
                _dbContext.CourtPrices.AddRange(priceEntities);
        }

        // Replace court_open_hours based on request
        var oldOpenHours = _dbContext.CourtOpenHours.Where(oh => oh.CourtId == court.Id);
        _dbContext.CourtOpenHours.RemoveRange(oldOpenHours);

        if (request.OpenHours is { Count: > 0 })
        {
            var openEntities = new List<CourtOpenHour>();
            foreach (var day in request.OpenHours)
            {
                if (!day.Enabled)
                {
                    openEntities.Add(new CourtOpenHour
                    {
                        Id = Guid.NewGuid(),
                        CourtId = court.Id,
                        DayOfWeek = day.DayOfWeek,
                        OpenTime = null,
                        CloseTime = null
                    });
                    continue;
                }

                if (string.IsNullOrWhiteSpace(day.OpenTime) || string.IsNullOrWhiteSpace(day.CloseTime))
                    return BadRequest(new { message = "OpenHours: Khi Enabled=true phải cung cấp OpenTime/CloseTime (HH:mm)." });

                if (!TimeOnly.TryParse(day.OpenTime, out var open) ||
                    !TimeOnly.TryParse(day.CloseTime, out var close))
                    return BadRequest(new { message = "OpenHours: OpenTime/CloseTime phải có định dạng HH:mm." });

                if (open >= close)
                    return BadRequest(new { message = "OpenHours: OpenTime phải nhỏ hơn CloseTime cho cùng một ngày." });

                openEntities.Add(new CourtOpenHour
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    DayOfWeek = day.DayOfWeek,
                    OpenTime = open,
                    CloseTime = close
                });
            }

            if (openEntities.Count > 0)
                _dbContext.CourtOpenHours.AddRange(openEntities);
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            court.Id,
            court.Name,
            court.Status,
            court.Surface,
            court.MaxGuest,
            court.Description,
            court.IsActive,
            court.VenueId
        });
    }

    /// <summary>
    /// Cập nhật trạng thái hoạt động của court (không đụng đến prices/open-hours).
    /// </summary>
    [HttpPatch("{venueId}/courts/{courtId}/status")]
    public async Task<IActionResult> SetCourtStatus(
        [FromRoute] Guid venueId,
        [FromRoute] Guid courtId,
        [FromBody] CourtStatusUpdateDto request)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền truy cập court cho venue này.");

        var court = await _dbContext.Courts.FirstOrDefaultAsync(c => c.Id == courtId && c.VenueId == venueId);
        if (court == null)
            return NotFound(new { message = "Court không tồn tại trong venue này." });

        court.IsActive = request.IsActive;
        await _dbContext.SaveChangesAsync();

        return Ok(new { court.Id, court.IsActive });
    }

    /// <summary>
    /// Upload ảnh gallery cho court (thay toàn bộ ảnh hiện có).
    /// </summary>
    [HttpPost("{venueId}/courts/{courtId}/files")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadCourtFiles(
        [FromRoute] Guid venueId,
        [FromRoute] Guid courtId,
        [FromForm(Name = "imageFiles")] List<IFormFile> imageFiles)
    {
        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _venueService.GetByIdAsync(venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid("Bạn không có quyền truy cập court cho venue này.");

        var court = await _dbContext.Courts
            .Include(c => c.Files)
            .FirstOrDefaultAsync(c => c.Id == courtId && c.VenueId == venueId);

        if (court == null)
            return NotFound(new { message = "Court không tồn tại trong venue này." });

        // Clear existing relationships; we keep old file records (if any).
        court.Files.Clear();

        // If FE gửi rỗng (xóa hết ảnh) thì chỉ cần clear & save.
        if (imageFiles is { Count: 0 } || imageFiles == null)
        {
            await _dbContext.SaveChangesAsync();
            return Ok(new { imageUrls = new List<string>() });
        }

        var cloudName = _config["Cloudinary:CloudName"]?.Trim();
        var apiKey = _config["Cloudinary:ApiKey"]?.Trim();
        var apiSecret = _config["Cloudinary:ApiSecret"]?.Trim();

        if (string.IsNullOrWhiteSpace(cloudName) ||
            string.IsNullOrWhiteSpace(apiKey) ||
            string.IsNullOrWhiteSpace(apiSecret))
        {
            return StatusCode(500, new { message = "Chưa cấu hình Cloudinary trên server (CloudName/ApiKey/ApiSecret)." });
        }

        var account = new Account(cloudName, apiKey, apiSecret);
        var cloudinary = new Cloudinary(account);

        var targetFolder = "courts";

        var uploadedUrls = new List<string>();
        for (var i = 0; i < imageFiles.Count; i++)
        {
            var img = imageFiles[i];
            if (img == null || img.Length == 0) continue;

            var publicId = $"court_{courtId}_{i}";

            using var stream = img.OpenReadStream();
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(img.FileName, stream),
                Folder = targetFolder,
                PublicId = publicId,
                Overwrite = true,
                Invalidate = true,
                Transformation = new Transformation()
                    .Crop("fill")
                    .Gravity("auto")
                    .Width(800)
                    .Height(600)
                    .FetchFormat("webp")
            };

            dynamic result;
            try
            {
                result = await cloudinary.UploadAsync(uploadParams);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Cloudinary upload exception: " + ex.Message });
            }

            var secureUrl = result?.SecureUrl?.ToString();
            if (string.IsNullOrWhiteSpace(secureUrl))
            {
                var errMsg = result?.Error?.Message?.ToString() ?? result?.Error?.ToString() ?? "SecureUrl is null";
                return StatusCode(500, new { message = "Upload Cloudinary thất bại: " + errMsg });
            }

            uploadedUrls.Add(secureUrl);

            var fileEntity = new ShuttleUp.DAL.Models.File
            {
                Id = Guid.NewGuid(),
                FileUrl = secureUrl,
                FileName = publicId,
                MimeType = img.ContentType,
                FileSize = (int?)img.Length,
                UploadedByUserId = managerId,
                CreatedAt = DateTime.UtcNow
            };

            // IMPORTANT:
            // Many-to-many insert order can cause FK error if EF doesn't track the new File row as Added.
            // We explicitly add it to DbContext before linking to court_files.
            _dbContext.Files.Add(fileEntity);
            court.Files.Add(fileEntity);
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { imageUrls = uploadedUrls });
    }

    /// <summary>
    /// Lấy chi tiết court để FE hiển thị form edit.
    /// </summary>
    [HttpGet("{venueId}/courts/{courtId}")]
    public async Task<IActionResult> GetCourtDetails(
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
            return Forbid("Bạn không có quyền truy cập court này.");

        var court = await _dbContext.Courts
            .Where(c => c.Id == courtId && c.VenueId == venueId)
            .Include(c => c.Files)
            .FirstOrDefaultAsync();

        if (court == null)
            return NotFound(new { message = "Court không tồn tại trong venue này." });

        var priceSlots = await _dbContext.CourtPrices
            .Where(p => p.CourtId == courtId)
            .Select(p => new
            {
                p.StartTime,
                p.EndTime,
                p.Price,
                p.IsWeekend
            })
            .ToListAsync();

        var openHours = await _dbContext.CourtOpenHours
            .Where(o => o.CourtId == courtId)
            .Select(o => new
            {
                o.DayOfWeek,
                Enabled = o.OpenTime.HasValue && o.CloseTime.HasValue,
                OpenTime = o.OpenTime,
                CloseTime = o.CloseTime
            })
            .ToListAsync();

        return Ok(new
        {
            court.Id,
            court.Name,
            court.GroupName,
            court.Status,
            court.Surface,
            court.MaxGuest,
            court.Description,
            court.IsActive,
            court.VenueId,
            Images = court.Files.Select(f => f.FileUrl).ToList(),
            PriceSlots = priceSlots.Select(p => new
            {
                StartTime = p.StartTime.HasValue ? p.StartTime.Value.ToString("HH:mm") : null,
                EndTime = p.EndTime.HasValue ? p.EndTime.Value.ToString("HH:mm") : null,
                p.Price,
                p.IsWeekend
            }),
            OpenHours = openHours.Select(o => new
            {
                o.DayOfWeek,
                o.Enabled,
                OpenTime = o.OpenTime.HasValue ? o.OpenTime.Value.ToString("HH:mm") : null,
                CloseTime = o.CloseTime.HasValue ? o.CloseTime.Value.ToString("HH:mm") : null
            })
        });
    }

    /// <summary>
    /// Xóa court trong venue do manager quản lý.
    /// </summary>
    [HttpDelete("{venueId}/courts/{courtId}")]
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
    [HttpGet("{venueId}/courts")]
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

        IEnumerable<Court> courts = await _dbContext.Courts
            .Where(c => c.VenueId == venueId)
            .Include(c => c.Files)
            .Include(c => c.CourtPrices)
            .ToListAsync();

        // Search
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            courts = courts.Where(c =>
                (!string.IsNullOrEmpty(c.Name) &&
                 c.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrEmpty(c.Status) &&
                 c.Status.Contains(keyword, StringComparison.OrdinalIgnoreCase)));
        }

        // Sort
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "name" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();

        courts = (sortBy, sortDir) switch
        {
            ("name", "asc") => courts.OrderBy(c => c.Name),
            ("name", "desc") => courts.OrderByDescending(c => c.Name),
            ("status", "asc") => courts.OrderBy(c => c.Status),
            ("status", "desc") => courts.OrderByDescending(c => c.Status),
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
                id = c.Id,
                venueId = c.VenueId,
                name = c.Name,
                groupName = c.GroupName,
                type = c.Status,
                surface = c.Surface,
                pricePerHour = (c.CourtPrices
                    .Where(cp => cp.IsWeekend != true && cp.Price.HasValue)
                    .Select(cp => cp.Price!.Value)
                    .DefaultIfEmpty(0m)
                    .Min()),
                priceWeekend = (c.CourtPrices
                    .Where(cp => cp.IsWeekend == true && cp.Price.HasValue)
                    .Select(cp => cp.Price!.Value)
                    .DefaultIfEmpty(0m)
                    .Min()),
                maxGuest = c.MaxGuest,
                description = c.Description,
                status = c.IsActive,
                addedOn = (string?)null,
                image = c.Files.Select(f => f.FileUrl).FirstOrDefault()
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

    public class VenueCheckoutSettingsDto
    {
        public string? PaymentBankName { get; set; }
        public string? PaymentBankBin { get; set; }
        public string? PaymentAccountNumber { get; set; }
        public string? PaymentAccountHolder { get; set; }
        public string? PaymentTransferNoteTemplate { get; set; }
        public bool CancelAllowed { get; set; } = true;
        public int CancelBeforeMinutes { get; set; } = 120;
        public string RefundType { get; set; } = "NONE";
        public decimal? RefundPercent { get; set; }
    }

    /// <summary>
    /// Cài đặt tài khoản nhận tiền + chính sách huỷ theo từng venue.
    /// </summary>
    [HttpPut("{venueId:guid}/checkout-settings")]
    public async Task<IActionResult> PutCheckoutSettings([FromRoute] Guid venueId, [FromBody] VenueCheckoutSettingsDto dto)
    {
        if (dto == null)
            return BadRequest(new { message = "Thiếu dữ liệu." });

        var managerId = GetCurrentUserId();
        if (managerId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng hiện tại." });

        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId);
        if (venue == null)
            return NotFound(new { message = "Venue không tồn tại." });

        if (venue.OwnerUserId != managerId)
            return Forbid();

        var refundType = string.IsNullOrWhiteSpace(dto.RefundType)
            ? "NONE"
            : dto.RefundType.Trim().ToUpperInvariant();
        if (refundType is not ("NONE" or "PERCENT" or "FULL"))
            return BadRequest(new { message = "refundType phải là NONE, PERCENT hoặc FULL." });

        if (dto.CancelBeforeMinutes < 0 || dto.CancelBeforeMinutes > 10080)
            return BadRequest(new { message = "cancelBeforeMinutes phải từ 0 đến 10080 (7 ngày)." });

        if (refundType == "PERCENT")
        {
            if (dto.RefundPercent is null)
                return BadRequest(new { message = "Vui lòng nhập refundPercent khi refundType = PERCENT." });
            if (dto.RefundPercent < 0 || dto.RefundPercent > 100)
                return BadRequest(new { message = "refundPercent phải từ 0 đến 100." });
        }

        venue.PaymentBankName = string.IsNullOrWhiteSpace(dto.PaymentBankName) ? null : dto.PaymentBankName.Trim();
        venue.PaymentBankBin = string.IsNullOrWhiteSpace(dto.PaymentBankBin) ? null : dto.PaymentBankBin.Trim();
        venue.PaymentAccountNumber = string.IsNullOrWhiteSpace(dto.PaymentAccountNumber) ? null : dto.PaymentAccountNumber.Trim();
        venue.PaymentAccountHolder = string.IsNullOrWhiteSpace(dto.PaymentAccountHolder) ? null : dto.PaymentAccountHolder.Trim().ToUpperInvariant();
        venue.PaymentTransferNoteTemplate = string.IsNullOrWhiteSpace(dto.PaymentTransferNoteTemplate)
            ? null
            : dto.PaymentTransferNoteTemplate.Trim();
        venue.CancelAllowed = dto.CancelAllowed;
        venue.CancelBeforeMinutes = dto.CancelBeforeMinutes;
        venue.RefundType = refundType;
        venue.RefundPercent = refundType == "PERCENT" ? dto.RefundPercent : null;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã lưu cài đặt thanh toán & huỷ đặt.",
            venueId = venue.Id,
        });
    }

    // =====================================================================
    // COUPON CRUD
    // =====================================================================

    public class CouponUpsertDto
    {
        public string Code { get; set; } = null!;
        public string DiscountType { get; set; } = "PERCENT"; // PERCENT | FIXED
        public decimal DiscountValue { get; set; }
        public decimal? MinBookingValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int? UsageLimit { get; set; }
        public bool IsActive { get; set; } = true;
    }

    /// <summary>Lấy danh sách coupon của venue.</summary>
    [HttpGet("{venueId:guid}/coupons")]
    public async Task<IActionResult> GetCoupons([FromRoute] Guid venueId)
    {
        var managerId = GetCurrentUserId();
        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId && v.OwnerUserId == managerId);
        if (venue == null) return NotFound(new { message = "Không tìm thấy sân hoặc bạn không có quyền." });

        var coupons = await _dbContext.VenueCoupons
            .AsNoTracking()
            .Where(c => c.VenueId == venueId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id, c.Code, c.DiscountType, c.DiscountValue,
                c.MinBookingValue, c.MaxDiscountAmount,
                c.StartDate, c.EndDate, c.UsageLimit, c.UsedCount, c.IsActive, c.CreatedAt
            })
            .ToListAsync();

        return Ok(coupons);
    }

    /// <summary>Tạo coupon mới cho venue.</summary>
    [HttpPost("{venueId:guid}/coupons")]
    public async Task<IActionResult> CreateCoupon([FromRoute] Guid venueId, [FromBody] CouponUpsertDto dto)
    {
        var managerId = GetCurrentUserId();
        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId && v.OwnerUserId == managerId);
        if (venue == null) return NotFound(new { message = "Không tìm thấy sân hoặc bạn không có quyền." });

        // Kiểm tra trùng mã
        var exists = await _dbContext.VenueCoupons.AnyAsync(c => c.VenueId == venueId && c.Code == dto.Code.Trim().ToUpper());
        if (exists) return BadRequest(new { message = "Mã coupon này đã tồn tại cho sân." });

        var coupon = new VenueCoupon
        {
            Id = Guid.NewGuid(),
            VenueId = venueId,
            Code = dto.Code.Trim().ToUpper(),
            DiscountType = dto.DiscountType,
            DiscountValue = dto.DiscountValue,
            MinBookingValue = dto.MinBookingValue,
            MaxDiscountAmount = dto.MaxDiscountAmount,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            UsageLimit = dto.UsageLimit,
            UsedCount = 0,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.VenueCoupons.Add(coupon);
        await _dbContext.SaveChangesAsync();

        return Ok(new { coupon.Id, coupon.Code, coupon.DiscountType, coupon.DiscountValue,
            coupon.MinBookingValue, coupon.MaxDiscountAmount, coupon.StartDate, coupon.EndDate,
            coupon.UsageLimit, coupon.UsedCount, coupon.IsActive, coupon.CreatedAt });
    }

    /// <summary>Cập nhật coupon.</summary>
    [HttpPut("{venueId:guid}/coupons/{couponId:guid}")]
    public async Task<IActionResult> UpdateCoupon([FromRoute] Guid venueId, [FromRoute] Guid couponId, [FromBody] CouponUpsertDto dto)
    {
        var managerId = GetCurrentUserId();
        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId && v.OwnerUserId == managerId);
        if (venue == null) return NotFound(new { message = "Không tìm thấy sân hoặc bạn không có quyền." });

        var coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.Id == couponId && c.VenueId == venueId);
        if (coupon == null) return NotFound(new { message = "Không tìm thấy coupon." });

        // Kiểm tra trùng mã (bỏ qua chính nó)
        var duplicate = await _dbContext.VenueCoupons.AnyAsync(c =>
            c.VenueId == venueId && c.Code == dto.Code.Trim().ToUpper() && c.Id != couponId);
        if (duplicate) return BadRequest(new { message = "Mã coupon này đã tồn tại cho sân." });

        coupon.Code = dto.Code.Trim().ToUpper();
        coupon.DiscountType = dto.DiscountType;
        coupon.DiscountValue = dto.DiscountValue;
        coupon.MinBookingValue = dto.MinBookingValue;
        coupon.MaxDiscountAmount = dto.MaxDiscountAmount;
        coupon.StartDate = dto.StartDate;
        coupon.EndDate = dto.EndDate;
        coupon.UsageLimit = dto.UsageLimit;
        coupon.IsActive = dto.IsActive;

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Cập nhật coupon thành công." });
    }

    /// <summary>Xoá coupon.</summary>
    [HttpDelete("{venueId:guid}/coupons/{couponId:guid}")]
    public async Task<IActionResult> DeleteCoupon([FromRoute] Guid venueId, [FromRoute] Guid couponId)
    {
        var managerId = GetCurrentUserId();
        var venue = await _dbContext.Venues.FirstOrDefaultAsync(v => v.Id == venueId && v.OwnerUserId == managerId);
        if (venue == null) return NotFound(new { message = "Không tìm thấy sân hoặc bạn không có quyền." });

        var coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.Id == couponId && c.VenueId == venueId);
        if (coupon == null) return NotFound(new { message = "Không tìm thấy coupon." });

        _dbContext.VenueCoupons.Remove(coupon);
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Xoá coupon thành công." });
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                          User.FindFirst(ClaimTypes.NameIdentifier);

        return Guid.TryParse(userIdClaim?.Value, out var id) ? id : Guid.Empty;
    }
}


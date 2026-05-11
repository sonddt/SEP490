using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.BLL.DTOs.Venue;
using ShuttleUp.BLL.Helpers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.BLL.Services;

public class CourtService : ICourtService
{
    private readonly ICourtRepository _courtRepo;
    private readonly IVenueRepository _venueRepo;
    private readonly ICourtBlockRepository _blockRepo;
    private readonly IFileRepository _fileRepo;
    private readonly Cloudinary _cloudinary;

    public CourtService(ICourtRepository courtRepo, IVenueRepository venueRepo, ICourtBlockRepository blockRepo, IFileRepository fileRepo, Cloudinary cloudinary)
    {
        _courtRepo = courtRepo; _venueRepo = venueRepo; _blockRepo = blockRepo; _fileRepo = fileRepo; _cloudinary = cloudinary;
    }

    // ── Basic CRUD ──
    public async Task<Court?> GetByIdAsync(Guid id) => await _courtRepo.GetByIdAsync(id);
    public async Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId) => await _courtRepo.GetByVenueAsync(venueId);
    public async Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId) => await _courtRepo.GetActiveCourtsByVenueAsync(venueId);
    public async Task CreateAsync(Court court) { court.Id = Guid.NewGuid(); court.IsActive = true; await _courtRepo.AddAsync(court); }
    public async Task UpdateAsync(Court court) => await _courtRepo.UpdateAsync(court);
    public async Task DeleteAsync(Guid id) => await _courtRepo.DeleteAsync(id);
    public async Task DeactivateAsync(Guid courtId) { var c = await _courtRepo.GetByIdAsync(courtId); if (c == null) return; c.IsActive = false; await _courtRepo.UpdateAsync(c); }

    // ── Create court with prices + open hours ──
    public async Task<object> CreateCourtWithConfigAsync(Guid venueId, Guid managerId, ManagerCourtUpsertDto dto)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var gn = string.IsNullOrWhiteSpace(dto.GroupName) ? null : dto.GroupName.Trim();
        if (!string.IsNullOrEmpty(gn) && gn.Length > 100) throw new InvalidOperationException("Tên nhóm tối đa 100 ký tự.");

        var court = new Court { Id = Guid.NewGuid(), VenueId = venueId, Name = dto.Name, GroupName = gn, Status = dto.Status, Surface = dto.Surface, MaxGuest = dto.MaxGuests, Description = dto.Description, IsActive = dto.IsActive ?? true };
        await _courtRepo.AddAsync(court);

        if (dto.PriceSlots is { Count: > 0 })
            await _courtRepo.AddCourtPricesAsync(BuildPrices(court.Id, dto.PriceSlots));
        if (dto.OpenHours is { Count: > 0 })
            await _courtRepo.AddCourtOpenHoursAsync(BuildOpenHours(court.Id, dto.OpenHours));

        return new { court.Id, court.Name, court.Status, court.Surface, court.MaxGuest, court.Description, court.IsActive, court.VenueId };
    }

    public async Task<object> UpdateCourtWithConfigAsync(Guid venueId, Guid courtId, Guid managerId, ManagerCourtUpsertDto dto)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var court = await _courtRepo.GetInVenueAsync(venueId, courtId) ?? throw new KeyNotFoundException("Court không tồn tại trong venue này.");

        var gn = string.IsNullOrWhiteSpace(dto.GroupName) ? null : dto.GroupName.Trim();
        if (!string.IsNullOrEmpty(gn) && gn.Length > 100) throw new InvalidOperationException("Tên nhóm tối đa 100 ký tự.");
        court.Name = dto.Name; court.GroupName = gn; court.Status = dto.Status; court.Surface = dto.Surface;
        court.MaxGuest = dto.MaxGuests; court.Description = dto.Description;
        if (dto.IsActive.HasValue) court.IsActive = dto.IsActive;
        await _courtRepo.UpdateAsync(court);

        await _courtRepo.ReplaceCourtPricesAsync(court.Id, dto.PriceSlots is { Count: > 0 } ? BuildPrices(court.Id, dto.PriceSlots) : new());
        await _courtRepo.ReplaceCourtOpenHoursAsync(court.Id, dto.OpenHours is { Count: > 0 } ? BuildOpenHours(court.Id, dto.OpenHours) : new());

        return new { court.Id, court.Name, court.Status, court.Surface, court.MaxGuest, court.Description, court.IsActive, court.VenueId };
    }

    public async Task<object?> GetCourtDetailAsync(Guid venueId, Guid courtId, Guid managerId)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var court = await _courtRepo.GetInVenueWithFilesAsync(venueId, courtId);
        if (court == null) return null;

        var prices = await _courtRepo.GetCourtPricesAsync(courtId);
        var hours = await _courtRepo.GetCourtOpenHoursAsync(courtId);

        return new
        {
            court.Id, court.Name, court.GroupName, court.Status, court.Surface, court.MaxGuest, court.Description, court.IsActive, court.VenueId,
            Images = court.Files.Select(f => f.FileUrl).ToList(),
            PriceSlots = prices.Select(p => new { StartTime = p.StartTime?.ToString("HH:mm"), EndTime = p.EndTime?.ToString("HH:mm"), p.Price, p.IsWeekend }),
            OpenHours = hours.Select(o => new { o.DayOfWeek, Enabled = o.OpenTime.HasValue && o.CloseTime.HasValue, OpenTime = o.OpenTime?.ToString("HH:mm"), CloseTime = o.CloseTime?.ToString("HH:mm") })
        };
    }

    public async Task<object> GetCourtsPagedAsync(Guid venueId, Guid managerId, string? search, string? sortBy, string? sortDir, int page, int pageSize)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var venue = await _venueRepo.GetByIdAsync(venueId)!;
        if (page <= 0) page = 1; if (pageSize <= 0) pageSize = 20; if (pageSize > 100) pageSize = 100;

        IEnumerable<Court> courts = await _courtRepo.GetByVenueWithPricesAndFilesAsync(venueId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim();
            courts = courts.Where(c => (!string.IsNullOrEmpty(c.Name) && c.Name.Contains(kw, StringComparison.OrdinalIgnoreCase)) || (!string.IsNullOrEmpty(c.Status) && c.Status.Contains(kw, StringComparison.OrdinalIgnoreCase)));
        }
        sortBy = string.IsNullOrWhiteSpace(sortBy) ? "name" : sortBy.Trim().ToLowerInvariant();
        sortDir = string.IsNullOrWhiteSpace(sortDir) ? "asc" : sortDir.Trim().ToLowerInvariant();
        courts = (sortBy, sortDir) switch
        {
            ("name", "desc") => courts.OrderByDescending(c => c.Name), ("status", "asc") => courts.OrderBy(c => c.Status),
            ("status", "desc") => courts.OrderByDescending(c => c.Status), ("isactive", "asc") => courts.OrderBy(c => c.IsActive),
            ("isactive", "desc") => courts.OrderByDescending(c => c.IsActive), _ => courts.OrderBy(c => c.Name)
        };
        var totalItems = courts.Count(); var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var items = courts.Skip((page - 1) * pageSize).Take(pageSize).Select(c => new
        {
            id = c.Id, venueId = c.VenueId, name = c.Name, groupName = c.GroupName, type = c.Status, surface = c.Surface,
            pricePerHour = c.CourtPrices.Where(cp => cp.IsWeekend != true && cp.Price.HasValue).Select(cp => cp.Price!.Value).DefaultIfEmpty(0m).Min(),
            priceWeekend = c.CourtPrices.Where(cp => cp.IsWeekend == true && cp.Price.HasValue).Select(cp => cp.Price!.Value).DefaultIfEmpty(0m).Min(),
            maxGuest = c.MaxGuest, description = c.Description, status = c.IsActive, image = c.Files.Select(f => f.FileUrl).FirstOrDefault()
        }).ToList();
        return new { venueName = venue!.Name, venueAddress = venue.Address, totalItems, totalPages, page, pageSize, items };
    }

    public async Task<object> SetCourtStatusAsync(Guid venueId, Guid courtId, Guid managerId, bool isActive, bool force)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var court = await _courtRepo.GetInVenueAsync(venueId, courtId) ?? throw new KeyNotFoundException("Court không tồn tại trong venue này.");
        if (!isActive && !force)
        {
            var count = await _courtRepo.CountFutureBookingsForCourtAsync(courtId);
            if (count > 0) throw new ConflictException("HAS_FUTURE_BOOKINGS", count);
        }
        court.IsActive = isActive;
        await _courtRepo.UpdateAsync(court);
        return new { court.Id, court.IsActive };
    }

    // ── Court Files ──
    public async Task<object> UploadCourtFilesAsync(Guid venueId, Guid courtId, Guid managerId, List<FileUploadInfo> files)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var court = await _courtRepo.GetInVenueWithFilesAsync(venueId, courtId) ?? throw new KeyNotFoundException("Court không tồn tại trong venue này.");
        court.Files.Clear();
        if (files is null or { Count: 0 }) { await _courtRepo.UpdateAsync(court); return new { imageUrls = new List<string>() }; }

        var uploadedUrls = new List<string>();
        for (var i = 0; i < files.Count; i++)
        {
            var f = files[i]; if (f.Length == 0) continue;
            var publicId = $"court_{courtId}_{i}";
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(f.FileName, f.Stream), Folder = "courts", PublicId = publicId, Overwrite = true, Invalidate = true,
                Transformation = new Transformation().Crop("fill").Gravity("auto").Width(800).Height(600).FetchFormat("webp")
            };
            var result = await _cloudinary.UploadAsync(uploadParams);
            var secureUrl = result?.SecureUrl?.ToString() ?? throw new InvalidOperationException("Upload Cloudinary thất bại.");
            uploadedUrls.Add(secureUrl);
            var fileEntity = new DalFile { Id = Guid.NewGuid(), FileUrl = secureUrl, FileName = publicId, MimeType = f.ContentType, FileSize = (int?)f.Length, UploadedByUserId = managerId, CreatedAt = DateTime.UtcNow };
            await _fileRepo.AddFileAsync(fileEntity);
            court.Files.Add(fileEntity);
        }
        await _courtRepo.UpdateAsync(court);
        return new { imageUrls = uploadedUrls };
    }

    // ── Court Blocks ──
    public async Task<object> GetCourtBlocksAsync(Guid venueId, Guid courtId, Guid managerId, string? from, string? to)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        await EnsureCourtInVenueAsync(venueId, courtId);
        var fromDay = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (!string.IsNullOrWhiteSpace(from) && !DateOnly.TryParse(from, out fromDay)) throw new InvalidOperationException("Tham số from phải là YYYY-MM-DD.");
        var toDay = fromDay.AddDays(30);
        if (!string.IsNullOrWhiteSpace(to) && !DateOnly.TryParse(to, out toDay)) throw new InvalidOperationException("Tham số to phải là YYYY-MM-DD.");
        if (toDay < fromDay) throw new InvalidOperationException("to phải sau hoặc bằng from.");

        var blocks = await _blockRepo.GetBlocksInRangeAsync(courtId, fromDay.ToDateTime(TimeOnly.MinValue), toDay.AddDays(1).ToDateTime(TimeOnly.MinValue));
        return blocks.Select(b => new { b.Id, startTime = b.StartTime, endTime = b.EndTime, b.ReasonCode, b.ReasonDetail, b.InternalNote, b.CreatedAt, b.UpdatedAt }).ToList();
    }

    public async Task<CourtBlockResult> CreateCourtBlockAsync(Guid venueId, Guid courtId, Guid managerId, CourtBlockUpsertDto dto)
    {
        var venue = await EnsureVenueOwnerAsync(venueId, managerId);
        await EnsureCourtInVenueAsync(venueId, courtId);
        if (dto.EndTime <= dto.StartTime) throw new InvalidOperationException("Thời gian kết thúc phải sau thời gian bắt đầu.");
        if (await _blockRepo.HasBookingOverlapAsync(courtId, dto.StartTime, dto.EndTime)) throw new ConflictException("Không thể khóa: đã có đơn đặt trùng khung giờ.", 0);
        if (await _blockRepo.HasBlockOverlapAsync(courtId, dto.StartTime, dto.EndTime, null)) throw new ConflictException("Khung giờ trùng với một khóa khác.", 0);

        var reason = TextHelper.NormalizeBlockReasonCode(dto.ReasonCode);
        var block = new CourtBlock
        {
            Id = Guid.NewGuid(), CourtId = courtId, StartTime = dto.StartTime, EndTime = dto.EndTime, CreatedBy = managerId,
            ReasonCode = reason, ReasonDetail = TextHelper.SanitizeText(dto.ReasonDetail, 500), InternalNote = TextHelper.SanitizeText(dto.InternalNote, 500),
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        await _blockRepo.AddAsync(block);

        var courtName = await _courtRepo.GetCourtNameAsync(courtId) ?? "Sân";
        var reasonLabel = TextHelper.BlockReasonLabels.GetValueOrDefault(reason, "Khác");
        var affectedUserIds = await _blockRepo.GetAffectedUserIdsAsync(courtId, dto.StartTime, dto.EndTime);

        return new CourtBlockResult
        {
            Block = new { block.Id, block.StartTime, block.EndTime, block.ReasonCode, block.ReasonDetail, block.InternalNote },
            CourtId = courtId, VenueId = venueId, VenueName = venue.Name ?? "", CourtName = courtName,
            StartTime = dto.StartTime, EndTime = dto.EndTime, ReasonLabel = reasonLabel, ReasonDetail = block.ReasonDetail,
            AffectedUserIds = affectedUserIds
        };
    }

    public async Task<object> UpdateCourtBlockAsync(Guid venueId, Guid courtId, Guid blockId, Guid managerId, CourtBlockUpsertDto dto)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        await EnsureCourtInVenueAsync(venueId, courtId);
        var block = await _blockRepo.GetByIdInCourtAsync(blockId, courtId) ?? throw new KeyNotFoundException("Không tìm thấy khóa lịch.");
        if (dto.EndTime <= dto.StartTime) throw new InvalidOperationException("Thời gian kết thúc phải sau thời gian bắt đầu.");
        if (await _blockRepo.HasBookingOverlapAsync(courtId, dto.StartTime, dto.EndTime)) throw new ConflictException("Không thể cập nhật: đã có đơn đặt trùng khung giờ.", 0);
        if (await _blockRepo.HasBlockOverlapAsync(courtId, dto.StartTime, dto.EndTime, blockId)) throw new ConflictException("Khung giờ trùng với một khóa khác.", 0);

        block.StartTime = dto.StartTime; block.EndTime = dto.EndTime;
        block.ReasonCode = TextHelper.NormalizeBlockReasonCode(dto.ReasonCode); block.ReasonDetail = TextHelper.SanitizeText(dto.ReasonDetail, 500);
        block.InternalNote = TextHelper.SanitizeText(dto.InternalNote, 500); block.UpdatedAt = DateTime.UtcNow;
        await _blockRepo.UpdateAsync(block);
        return new { block.Id, block.StartTime, block.EndTime, block.ReasonCode, block.ReasonDetail, block.InternalNote };
    }

    public async Task DeleteCourtBlockAsync(Guid venueId, Guid courtId, Guid blockId, Guid managerId)
    {
        await EnsureVenueOwnerAsync(venueId, managerId); await EnsureCourtInVenueAsync(venueId, courtId);
        var block = await _blockRepo.GetByIdInCourtAsync(blockId, courtId) ?? throw new KeyNotFoundException("Không tìm thấy khóa lịch.");
        await _blockRepo.DeleteAsync(blockId);
    }

    // ── Private helpers ──
    private async Task<Venue> EnsureVenueOwnerAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        return venue;
    }

    private async Task EnsureCourtInVenueAsync(Guid venueId, Guid courtId)
    {
        var court = await _courtRepo.GetInVenueAsync(venueId, courtId);
        if (court == null) throw new KeyNotFoundException("Court không tồn tại trong venue này.");
    }

    private static List<CourtPrice> BuildPrices(Guid courtId, List<ManagerCourtPriceSlotDto> slots) =>
        slots.Select(s =>
        {
            if (!TimeOnly.TryParse(s.StartTime, out var st) || !TimeOnly.TryParse(s.EndTime, out var et)) throw new InvalidOperationException("StartTime/EndTime phải có định dạng HH:mm.");
            if (st >= et) throw new InvalidOperationException("StartTime phải nhỏ hơn EndTime.");
            return new CourtPrice { Id = Guid.NewGuid(), CourtId = courtId, StartTime = st, EndTime = et, Price = s.Price, IsWeekend = s.IsWeekend };
        }).ToList();

    private static List<CourtOpenHour> BuildOpenHours(Guid courtId, List<ManagerCourtOpenHourDto> days) =>
        days.Select(day =>
        {
            if (!day.Enabled) return new CourtOpenHour { Id = Guid.NewGuid(), CourtId = courtId, DayOfWeek = day.DayOfWeek };
            if (string.IsNullOrWhiteSpace(day.OpenTime) || string.IsNullOrWhiteSpace(day.CloseTime)) throw new InvalidOperationException("OpenHours: Khi Enabled=true phải cung cấp OpenTime/CloseTime.");
            if (!TimeOnly.TryParse(day.OpenTime, out var o) || !TimeOnly.TryParse(day.CloseTime, out var cl)) throw new InvalidOperationException("OpenHours: OpenTime/CloseTime phải có định dạng HH:mm.");
            if (o >= cl) throw new InvalidOperationException("OpenHours: OpenTime phải nhỏ hơn CloseTime.");
            return new CourtOpenHour { Id = Guid.NewGuid(), CourtId = courtId, DayOfWeek = day.DayOfWeek, OpenTime = o, CloseTime = cl };
        }).ToList();
}

/// <summary>Custom exception for HTTP 409 Conflict scenarios</summary>
public class ConflictException : Exception
{
    public int Count { get; }
    public ConflictException(string message, int count) : base(message) { Count = count; }
}

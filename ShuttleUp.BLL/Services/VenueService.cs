using System.Text.Json;
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

public class VenueService : IVenueService
{
    private readonly IVenueRepository _venueRepo;
    private readonly IFileRepository _fileRepo;
    private readonly IVenueCouponRepository _couponRepo;
    private readonly Cloudinary _cloudinary;

    public VenueService(IVenueRepository venueRepo, IFileRepository fileRepo, IVenueCouponRepository couponRepo, Cloudinary cloudinary)
    {
        _venueRepo = venueRepo;
        _fileRepo = fileRepo;
        _couponRepo = couponRepo;
        _cloudinary = cloudinary;
    }

    // ── Basic CRUD ──
    public async Task<Venue?> GetByIdAsync(Guid id) => await _venueRepo.GetByIdAsync(id);
    public async Task<IEnumerable<Venue>> GetAllAsync() => await _venueRepo.GetAllAsync();
    public async Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId) => await _venueRepo.GetByOwnerAsync(ownerUserId);
    public async Task<IEnumerable<Venue>> GetApprovedVenuesAsync() => await _venueRepo.GetApprovedVenuesAsync();
    public async Task CreateAsync(Venue venue) { venue.Id = Guid.NewGuid(); venue.CreatedAt = DateTime.UtcNow; venue.IsActive = false; await _venueRepo.AddAsync(venue); }
    public async Task UpdateAsync(Venue venue) => await _venueRepo.UpdateAsync(venue);
    public async Task DeleteAsync(Guid id) => await _venueRepo.DeleteAsync(id);

    // ── Managed Venues List ──
    public async Task<object> GetManagedVenuesPagedAsync(Guid managerId, string? search, string? sortBy, string? sortDir, int page, int pageSize)
    {
        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var totalItems = await _venueRepo.CountByOwnerAsync(managerId, search);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var venueList = await _venueRepo.GetByOwnerPagedAsync(managerId, search, sortBy ?? "createdAt", sortDir ?? "desc", (page - 1) * pageSize, pageSize);

        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var items = venueList.Select(v =>
        {
            var courts = v.Courts ?? new List<Court>();
            var imageUrl = v.Files.Where(f => f.FileName != null && f.FileName.Contains("mac_dinh")).Select(f => f.FileUrl).FirstOrDefault()
                           ?? v.Files.OrderByDescending(f => f.CreatedAt).Select(f => f.FileUrl).FirstOrDefault();
            var monthBookings = (v.Bookings ?? new List<Booking>())
                .Where(b => b.CreatedAt.HasValue && b.CreatedAt.Value >= startOfMonth && b.Status != null && b.Status != "CANCELLED").ToList();
            return new
            {
                v.Id, v.Name, v.Address, v.IsActive, v.CreatedAt, imageUrl,
                courtCount = courts.Count, activeCourts = courts.Count(c => c.IsActive == true && c.Status == "ACTIVE"),
                totalBookingsThisMonth = monthBookings.Count,
                revenueThisMonth = monthBookings.Where(b => b.Status == "CONFIRMED" || b.Status == "COMPLETED").Sum(b => b.FinalAmount ?? 0m)
            };
        }).ToList();
        return new { totalItems, totalPages, page, pageSize, items };
    }

    public async Task<object?> GetManagedVenueDetailAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAndOwnerAsync(venueId, managerId);
        if (venue == null) return null;
        static List<string>? ParseJsonArray(string? json)
        { if (string.IsNullOrWhiteSpace(json)) return null; try { return JsonSerializer.Deserialize<List<string>>(json); } catch { return null; } }
        return new
        {
            venue.Id, venue.Name, venue.Address, venue.Lat, venue.Lng, venue.ContactName, venue.ContactPhone,
            venue.WeeklyDiscountPercent, venue.MonthlyDiscountPercent, venue.SlotDuration, venue.Description,
            Includes = ParseJsonArray(venue.Includes), Rules = ParseJsonArray(venue.Rules), Amenities = ParseJsonArray(venue.Amenities),
            venue.IsActive, venue.CreatedAt
        };
    }

    public async Task<object> PublishVenueAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        if (!await _venueRepo.HasActiveCourtAsync(venueId))
            throw new InvalidOperationException("Venue phải có ít nhất 1 sân đang hoạt động trước khi publish.");
        if (!await _venueRepo.HasCourtPricingAsync(venueId))
            throw new InvalidOperationException("Venue phải cấu hình giá sân trước khi publish.");
        if (!await _venueRepo.HasOpenHoursAsync(venueId))
            throw new InvalidOperationException("Venue phải cấu hình giờ mở cửa trước khi publish.");
        venue.IsActive = true;
        await _venueRepo.UpdateAsync(venue);
        return new { message = "Publish trạng thái thành công.", isActive = true };
    }

    public async Task<object> UnpublishVenueAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        if (await _venueRepo.HasFutureBookingsAsync(venueId))
            throw new InvalidOperationException("Không thể unpublish. Cụm sân đang có lịch đặt ở tương lai.");
        venue.IsActive = false;
        await _venueRepo.UpdateAsync(venue);
        return new { message = "Unpublish trạng thái thành công.", isActive = false };
    }

    public async Task<object> EditVenueAsync(Guid venueId, Guid managerId, ManagerVenueUpsertDto dto)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();

        venue.Name = dto.Name; venue.Address = dto.Address; venue.Lat = dto.Lat; venue.Lng = dto.Lng;
        venue.ContactName = dto.ContactName; venue.ContactPhone = dto.ContactPhone;
        venue.WeeklyDiscountPercent = dto.WeeklyDiscountPercent; venue.MonthlyDiscountPercent = dto.MonthlyDiscountPercent;
        venue.Description = dto.Description;
        venue.Includes = dto.Includes != null ? JsonSerializer.Serialize(dto.Includes) : null;
        venue.Rules = dto.Rules != null ? JsonSerializer.Serialize(dto.Rules) : null;
        venue.Amenities = dto.Amenities != null ? JsonSerializer.Serialize(dto.Amenities) : null;

        int newSlot = dto.SlotDuration == 30 || dto.SlotDuration == 120 ? dto.SlotDuration : 60;
        if (newSlot != venue.SlotDuration && await _venueRepo.HasFutureBookingsAsync(venueId))
            throw new InvalidOperationException("Không thể thay đổi đơn vị giờ chẵn khi còn đơn đặt sân trong tương lai.");
        venue.SlotDuration = newSlot;

        await _venueRepo.UpdateAsync(venue);
        return new { venue.Id, venue.Name, venue.Address, venue.ContactName, venue.ContactPhone, venue.IsActive, venue.CreatedAt };
    }

    public async Task<object> DeleteVenueAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        await _venueRepo.DeleteAsync(venueId);
        return new { message = "Đã xóa venue." };
    }

    // ── Venue Files ──
    public async Task<object> UploadVenueFilesAsync(Guid venueId, Guid managerId, List<FileUploadInfo> files)
    {
        var venue = await _venueRepo.GetByIdWithFilesAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        if (files == null || files.Count == 0) throw new InvalidOperationException("Không có file nào được chọn.");

        var uploadedUrls = new List<string>();
        foreach (var f in files)
        {
            if (f.Length == 0) continue;
            var publicId = $"venue_{venueId}_{Guid.NewGuid().ToString("N")[..8]}";
            var secureUrl = await UploadToCloudinaryAsync(f, "shuttleup_venues", publicId);
            uploadedUrls.Add(secureUrl);

            var fileEntity = new DalFile { Id = Guid.NewGuid(), FileUrl = secureUrl, FileName = publicId, MimeType = f.ContentType, FileSize = (int?)f.Length, UploadedByUserId = managerId, CreatedAt = DateTime.UtcNow };
            await _fileRepo.AddFileAsync(fileEntity);
            venue.Files.Add(fileEntity);
        }
        await _venueRepo.UpdateAsync(venue);
        return new { imageUrls = uploadedUrls };
    }

    public async Task DeleteVenueFileAsync(Guid venueId, Guid fileId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdWithFilesAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();
        var file = venue.Files.FirstOrDefault(f => f.Id == fileId) ?? throw new KeyNotFoundException("Không tìm thấy file.");
        venue.Files.Remove(file);
        await _venueRepo.UpdateAsync(venue);
    }

    // ── Checkout Settings ──
    public async Task<object?> GetCheckoutSettingsAsync(Guid venueId, Guid managerId, decimal? amount, string? addInfo)
    {
        var v = await _venueRepo.GetByIdAndOwnerAsync(venueId, managerId);
        if (v == null) return null;
        var bin = VietQrHelper.ResolveBin(v.PaymentBankBin, v.PaymentBankName);
        var vietQrUrl = VietQrHelper.BuildQrImageUrl(bin, v.PaymentAccountNumber, amount ?? 0m, string.IsNullOrWhiteSpace(addInfo) ? null : addInfo.Trim());
        return new
        {
            venueId = v.Id, venueName = v.Name, bankName = v.PaymentBankName, bankBin = bin,
            accountNumber = v.PaymentAccountNumber, accountHolder = v.PaymentAccountHolder,
            transferNoteTemplate = v.PaymentTransferNoteTemplate ?? "[SĐT] - [Tên sân] - [Ngày]",
            paymentNote = v.PaymentNote, venueRules = v.VenueRules, vietQrImageUrl = vietQrUrl,
            cancellation = new { allowCancel = v.CancelAllowed, cancelBeforeMinutes = v.CancelBeforeMinutes, refundType = v.RefundType ?? "NONE", refundPercent = v.RefundPercent }
        };
    }

    public async Task<object> SaveCheckoutSettingsAsync(Guid venueId, Guid managerId, VenueCheckoutSettingsDto dto)
    {
        var venue = await _venueRepo.GetByIdTrackedAsync(venueId) ?? throw new KeyNotFoundException("Venue không tồn tại.");
        if (venue.OwnerUserId != managerId) throw new UnauthorizedAccessException();

        var bankName = dto.PaymentBankName?.Trim(); var acctNum = dto.PaymentAccountNumber?.Trim(); var acctHolder = dto.PaymentAccountHolder?.Trim().ToUpperInvariant();
        var hasBankData = !string.IsNullOrWhiteSpace(bankName) || !string.IsNullOrWhiteSpace(acctNum) || !string.IsNullOrWhiteSpace(acctHolder);
        if (hasBankData)
        {
            if (string.IsNullOrWhiteSpace(bankName)) throw new InvalidOperationException("Vui lòng chọn hoặc nhập tên ngân hàng.");
            if (string.IsNullOrWhiteSpace(acctNum)) throw new InvalidOperationException("Vui lòng nhập số tài khoản.");
            if (!System.Text.RegularExpressions.Regex.IsMatch(acctNum, @"^\d{6,19}$")) throw new InvalidOperationException("Số tài khoản chỉ được chứa chữ số và dài từ 6 đến 19 ký tự.");
            if (string.IsNullOrWhiteSpace(acctHolder)) throw new InvalidOperationException("Vui lòng nhập tên chủ tài khoản.");
        }
        var refundType = string.IsNullOrWhiteSpace(dto.RefundType) ? "NONE" : dto.RefundType.Trim().ToUpperInvariant();
        if (refundType is not ("NONE" or "PERCENT" or "FULL")) throw new InvalidOperationException("refundType phải là NONE, PERCENT hoặc FULL.");
        if (dto.CancelBeforeMinutes < 0 || dto.CancelBeforeMinutes > 10080) throw new InvalidOperationException("cancelBeforeMinutes phải từ 0 đến 10080.");
        if (refundType == "PERCENT") { if (dto.RefundPercent is null or < 0 or > 100) throw new InvalidOperationException("refundPercent phải từ 0 đến 100."); }

        venue.PaymentBankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName;
        venue.PaymentBankBin = string.IsNullOrWhiteSpace(dto.PaymentBankBin?.Trim()) ? null : dto.PaymentBankBin!.Trim();
        venue.PaymentAccountNumber = string.IsNullOrWhiteSpace(acctNum) ? null : acctNum;
        venue.PaymentAccountHolder = string.IsNullOrWhiteSpace(acctHolder) ? null : acctHolder;
        venue.PaymentTransferNoteTemplate = string.IsNullOrWhiteSpace(dto.PaymentTransferNoteTemplate?.Trim()) ? null : dto.PaymentTransferNoteTemplate!.Trim();
        venue.PaymentNote = TextHelper.SanitizeText(dto.PaymentNote);
        venue.VenueRules = TextHelper.SanitizeText(dto.VenueRules, 5000);
        venue.CancelAllowed = dto.CancelAllowed; venue.CancelBeforeMinutes = dto.CancelBeforeMinutes;
        venue.RefundType = refundType; venue.RefundPercent = refundType == "PERCENT" ? dto.RefundPercent : null;

        var bulkCount = 0;
        if (dto.ApplyToAll)
        {
            var others = await _venueRepo.GetByOwnerForCheckoutUpdateAsync(managerId, venueId);
            foreach (var v in others)
            {
                v.PaymentBankName = venue.PaymentBankName; v.PaymentBankBin = venue.PaymentBankBin;
                v.PaymentAccountNumber = venue.PaymentAccountNumber; v.PaymentAccountHolder = venue.PaymentAccountHolder;
                v.PaymentTransferNoteTemplate = venue.PaymentTransferNoteTemplate; v.PaymentNote = venue.PaymentNote;
            }
            bulkCount = others.Count;
            foreach (var v in others) await _venueRepo.UpdateAsync(v, false);
        }
        await _venueRepo.UpdateAsync(venue);
        return new { message = dto.ApplyToAll && bulkCount > 0 ? $"Đã lưu cài đặt, đồng thời áp dụng cho {bulkCount} cụm sân khác." : "Đã lưu cài đặt thanh toán & huỷ đặt.", venueId = venue.Id, bulkApplied = bulkCount };
    }

    // ── Coupons ──
    public async Task<object> GetCouponsAsync(Guid venueId, Guid managerId)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var coupons = await _couponRepo.GetByVenueOrderedAsync(venueId);
        return coupons.Select(c => new { c.Id, c.Code, c.DiscountType, c.DiscountValue, c.MinBookingValue, c.MaxDiscountAmount, c.StartDate, c.EndDate, c.UsageLimit, c.UsedCount, c.IsActive, c.OneUsePerUser, c.CreatedAt }).ToList();
    }

    public async Task<object> CreateCouponAsync(Guid venueId, Guid managerId, CouponUpsertDto dto)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        if (await _couponRepo.CodeExistsAsync(venueId, dto.Code.Trim().ToUpper()))
            throw new InvalidOperationException("Mã coupon này đã tồn tại cho sân.");
        var coupon = new VenueCoupon
        {
            Id = Guid.NewGuid(), VenueId = venueId, Code = dto.Code.Trim().ToUpper(), DiscountType = dto.DiscountType,
            DiscountValue = dto.DiscountValue, MinBookingValue = dto.MinBookingValue, MaxDiscountAmount = dto.MaxDiscountAmount,
            StartDate = dto.StartDate, EndDate = dto.EndDate, UsageLimit = dto.UsageLimit, UsedCount = 0,
            IsActive = dto.IsActive, OneUsePerUser = dto.OneUsePerUser, CreatedAt = DateTime.UtcNow
        };
        await _couponRepo.AddAsync(coupon);
        return new { coupon.Id, coupon.Code, coupon.DiscountType, coupon.DiscountValue, coupon.MinBookingValue, coupon.MaxDiscountAmount, coupon.StartDate, coupon.EndDate, coupon.UsageLimit, coupon.UsedCount, coupon.IsActive, coupon.OneUsePerUser, coupon.CreatedAt };
    }

    public async Task<object> UpdateCouponAsync(Guid venueId, Guid couponId, Guid managerId, CouponUpsertDto dto)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var coupon = await _couponRepo.GetByIdInVenueAsync(couponId, venueId) ?? throw new KeyNotFoundException("Không tìm thấy coupon.");
        if (await _couponRepo.CodeExistsAsync(venueId, dto.Code.Trim().ToUpper(), couponId))
            throw new InvalidOperationException("Mã coupon này đã tồn tại cho sân.");
        coupon.Code = dto.Code.Trim().ToUpper(); coupon.DiscountType = dto.DiscountType; coupon.DiscountValue = dto.DiscountValue;
        coupon.MinBookingValue = dto.MinBookingValue; coupon.MaxDiscountAmount = dto.MaxDiscountAmount;
        coupon.StartDate = dto.StartDate; coupon.EndDate = dto.EndDate; coupon.UsageLimit = dto.UsageLimit;
        coupon.IsActive = dto.IsActive; coupon.OneUsePerUser = dto.OneUsePerUser;
        await _couponRepo.UpdateAsync(coupon);
        return new { message = "Cập nhật coupon thành công." };
    }

    public async Task DeleteCouponAsync(Guid venueId, Guid couponId, Guid managerId)
    {
        await EnsureVenueOwnerAsync(venueId, managerId);
        var coupon = await _couponRepo.GetByIdInVenueAsync(couponId, venueId) ?? throw new KeyNotFoundException("Không tìm thấy coupon.");
        await _couponRepo.DeleteAsync(couponId);
    }

    // ── Private helpers ──
    private async Task EnsureVenueOwnerAsync(Guid venueId, Guid managerId)
    {
        var venue = await _venueRepo.GetByIdAndOwnerAsync(venueId, managerId);
        if (venue == null) throw new KeyNotFoundException("Không tìm thấy sân hoặc bạn không có quyền.");
    }

    private async Task<string> UploadToCloudinaryAsync(FileUploadInfo file, string folder, string publicId)
    {
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, file.Stream), Folder = folder, PublicId = publicId, Overwrite = true,
            Transformation = new Transformation().Crop("fill").Gravity("auto").Width(800).Height(600).FetchFormat("webp")
        };
        var result = await _cloudinary.UploadAsync(uploadParams);
        return result?.SecureUrl?.ToString() ?? throw new InvalidOperationException("Cloudinary upload failed.");
    }
}

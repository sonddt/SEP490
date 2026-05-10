using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.BLL.DTOs.Venue;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IVenueService
{
    // ── Existing ──
    Task<Venue?> GetByIdAsync(Guid id);
    Task<IEnumerable<Venue>> GetAllAsync();
    Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId);
    Task<IEnumerable<Venue>> GetApprovedVenuesAsync();
    Task CreateAsync(Venue venue);
    Task UpdateAsync(Venue venue);
    Task DeleteAsync(Guid id);

    // ── Manager Venues (expanded) ──
    Task<object> GetManagedVenuesPagedAsync(Guid managerId, string? search, string? sortBy, string? sortDir, int page, int pageSize);
    Task<object?> GetManagedVenueDetailAsync(Guid venueId, Guid managerId);
    Task<object> PublishVenueAsync(Guid venueId, Guid managerId);
    Task<object> UnpublishVenueAsync(Guid venueId, Guid managerId);
    Task<object> EditVenueAsync(Guid venueId, Guid managerId, ManagerVenueUpsertDto dto);
    Task<object> DeleteVenueAsync(Guid venueId, Guid managerId);

    // ── Venue Files ──
    Task<object> UploadVenueFilesAsync(Guid venueId, Guid managerId, List<FileUploadInfo> files);
    Task DeleteVenueFileAsync(Guid venueId, Guid fileId, Guid managerId);

    // ── Checkout Settings ──
    Task<object?> GetCheckoutSettingsAsync(Guid venueId, Guid managerId, decimal? amount, string? addInfo);
    Task<object> SaveCheckoutSettingsAsync(Guid venueId, Guid managerId, VenueCheckoutSettingsDto dto);

    // ── Coupons ──
    Task<object> GetCouponsAsync(Guid venueId, Guid managerId);
    Task<object> CreateCouponAsync(Guid venueId, Guid managerId, CouponUpsertDto dto);
    Task<object> UpdateCouponAsync(Guid venueId, Guid couponId, Guid managerId, CouponUpsertDto dto);
    Task DeleteCouponAsync(Guid venueId, Guid couponId, Guid managerId);
}

public class FileUploadInfo
{
    public Stream Stream { get; set; } = null!;
    public string FileName { get; set; } = "";
    public string? ContentType { get; set; }
    public long Length { get; set; }
}

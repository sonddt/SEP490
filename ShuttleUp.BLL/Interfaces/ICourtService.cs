using ShuttleUp.BLL.DTOs.Manager;
using ShuttleUp.BLL.DTOs.Venue;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface ICourtService
{
    Task<Court?> GetByIdAsync(Guid id);
    Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId);
    Task CreateAsync(Court court);
    Task UpdateAsync(Court court);
    Task DeleteAsync(Guid id);
    Task DeactivateAsync(Guid courtId);

    // ── Expanded for ManagerVenuesController ──
    Task<object> CreateCourtWithConfigAsync(Guid venueId, Guid managerId, ManagerCourtUpsertDto dto);
    Task<object> UpdateCourtWithConfigAsync(Guid venueId, Guid courtId, Guid managerId, ManagerCourtUpsertDto dto);
    Task<object?> GetCourtDetailAsync(Guid venueId, Guid courtId, Guid managerId);
    Task<object> GetCourtsPagedAsync(Guid venueId, Guid managerId, string? search, string? sortBy, string? sortDir, int page, int pageSize);
    Task<object> SetCourtStatusAsync(Guid venueId, Guid courtId, Guid managerId, bool isActive, bool force);

    // Court files
    Task<object> UploadCourtFilesAsync(Guid venueId, Guid courtId, Guid managerId, List<FileUploadInfo> files);

    // Court blocks
    Task<object> GetCourtBlocksAsync(Guid venueId, Guid courtId, Guid managerId, string? from, string? to);
    Task<CourtBlockResult> CreateCourtBlockAsync(Guid venueId, Guid courtId, Guid managerId, CourtBlockUpsertDto dto);
    Task<object> UpdateCourtBlockAsync(Guid venueId, Guid courtId, Guid blockId, Guid managerId, CourtBlockUpsertDto dto);
    Task DeleteCourtBlockAsync(Guid venueId, Guid courtId, Guid blockId, Guid managerId);
}

public class CourtBlockResult
{
    public object Block { get; set; } = null!;
    public Guid CourtId { get; set; }
    public Guid VenueId { get; set; }
    public string VenueName { get; set; } = "";
    public string CourtName { get; set; } = "";
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string ReasonLabel { get; set; } = "";
    public string? ReasonDetail { get; set; }
    public List<Guid> AffectedUserIds { get; set; } = new();
}

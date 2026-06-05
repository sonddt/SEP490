using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface ICourtRepository : IRepository<Court>
{
    Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId);
    Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId);

    // ── Expanded ──
    Task<Court?> GetInVenueAsync(Guid venueId, Guid courtId);
    Task<Court?> GetInVenueWithFilesAsync(Guid venueId, Guid courtId);
    Task<List<Court>> GetByVenueWithPricesAndFilesAsync(Guid venueId);

    // Court Prices
    Task ReplaceCourtPricesAsync(Guid courtId, List<CourtPrice> newPrices);
    Task AddCourtPricesAsync(List<CourtPrice> prices);

    // Court Open Hours
    Task ReplaceCourtOpenHoursAsync(Guid courtId, List<CourtOpenHour> newHours);
    Task AddCourtOpenHoursAsync(List<CourtOpenHour> hours);

    // Query price/hours for detail
    Task<List<CourtPrice>> GetCourtPricesAsync(Guid courtId);
    Task<List<CourtOpenHour>> GetCourtOpenHoursAsync(Guid courtId);

    // Stats
    Task<int> CountByVenueIdsAsync(List<Guid> venueIds);
    Task<int> CountActiveByVenueIdsAsync(List<Guid> venueIds);
    Task<int> CountFutureBookingsForCourtAsync(Guid courtId);
    Task<string?> GetCourtNameAsync(Guid courtId);
}

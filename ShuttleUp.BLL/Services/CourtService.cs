using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class CourtService : ICourtService
{
    private readonly ICourtRepository _courtRepository;

    public CourtService(ICourtRepository courtRepository)
    {
        _courtRepository = courtRepository;
    }

    public async Task<Court?> GetByIdAsync(Guid id)
        => await _courtRepository.GetByIdAsync(id);

    public async Task<IEnumerable<Court>> GetByVenueAsync(Guid venueId)
        => await _courtRepository.GetByVenueAsync(venueId);

    public async Task<IEnumerable<Court>> GetActiveCourtsByVenueAsync(Guid venueId)
        => await _courtRepository.GetActiveCourtsByVenueAsync(venueId);

    public async Task CreateAsync(Court court)
    {
        court.Id = Guid.NewGuid();
        court.IsActive = true;
        await _courtRepository.AddAsync(court);
    }

    public async Task UpdateAsync(Court court)
        => await _courtRepository.UpdateAsync(court);

    public async Task DeleteAsync(Guid id)
        => await _courtRepository.DeleteAsync(id);

    public async Task DeactivateAsync(Guid courtId)
    {
        var court = await _courtRepository.GetByIdAsync(courtId);
        if (court == null) return;
        court.IsActive = false;
        await _courtRepository.UpdateAsync(court);
    }
}

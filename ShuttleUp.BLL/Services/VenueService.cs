using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class VenueService : IVenueService
{
    private readonly IVenueRepository _venueRepository;

    public VenueService(IVenueRepository venueRepository)
    {
        _venueRepository = venueRepository;
    }

    public async Task<Venue?> GetByIdAsync(Guid id)
        => await _venueRepository.GetByIdAsync(id);

    public async Task<IEnumerable<Venue>> GetAllAsync()
        => await _venueRepository.GetAllAsync();

    public async Task<IEnumerable<Venue>> GetByOwnerAsync(Guid ownerUserId)
        => await _venueRepository.GetByOwnerAsync(ownerUserId);

    public async Task<IEnumerable<Venue>> GetApprovedVenuesAsync()
        => await _venueRepository.GetApprovedVenuesAsync();



    public async Task CreateAsync(Venue venue)
    {
        venue.Id = Guid.NewGuid();
        venue.CreatedAt = DateTime.UtcNow;
        venue.IsActive = false;
        await _venueRepository.AddAsync(venue);
    }

    public async Task UpdateAsync(Venue venue)
        => await _venueRepository.UpdateAsync(venue);

    public async Task DeleteAsync(Guid id)
        => await _venueRepository.DeleteAsync(id);


}

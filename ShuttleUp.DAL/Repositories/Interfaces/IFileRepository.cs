using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IFileRepository : IRepository<DalFile>
{
    Task<List<DalFile>> GetByIdsAsync(List<Guid> ids);
    Task AddFileAsync(DalFile file);
}

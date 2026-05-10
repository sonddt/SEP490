using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.DAL.Repositories;

public class FileRepository : Repository<DalFile>, IFileRepository
{
    public FileRepository(ShuttleUpDbContext context) : base(context) { }

    public async Task<List<DalFile>> GetByIdsAsync(List<Guid> ids)
        => ids.Count == 0 ? new List<DalFile>() : await _dbSet.AsNoTracking().Where(f => ids.Contains(f.Id)).ToListAsync();

    public async Task AddFileAsync(DalFile file)
    {
        await _dbSet.AddAsync(file);
        await _context.SaveChangesAsync();
    }
}

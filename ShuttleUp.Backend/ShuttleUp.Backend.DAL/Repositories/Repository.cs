using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly ShuttleUpDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(ShuttleUpDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id)
    {
        return await _dbSet.FindAsync(id);
    }

    public async Task<IEnumerable<T>> GetAllAsync()
    {
        return await _dbSet.ToListAsync();
    }

    public async Task AddAsync(T entity, bool saveChanges = true)
    {
        await _dbSet.AddAsync(entity);
        if (saveChanges) await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(T entity, bool saveChanges = true)
    {
        _dbSet.Update(entity);
        if (saveChanges) await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id, bool saveChanges = true)
    {
        var entity = await GetByIdAsync(id);
        if (entity != null)
        {
            _dbSet.Remove(entity);
            if (saveChanges) await _context.SaveChangesAsync();
        }
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IEnumerable<T>> GetAllAsync();
    Task AddAsync(T entity, bool saveChanges = true);
    Task UpdateAsync(T entity, bool saveChanges = true);
    Task DeleteAsync(Guid id, bool saveChanges = true);
    Task SaveChangesAsync();
}

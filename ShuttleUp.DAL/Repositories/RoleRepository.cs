using Microsoft.EntityFrameworkCore;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.DAL.Repositories;

public class RoleRepository : Repository<Role>, IRoleRepository
{
    public RoleRepository(ShuttleUpDbContext context) : base(context)
    {
    }

    public async Task<Role?> GetByNameAsync(string name)
    {
        return await _dbSet.FirstOrDefaultAsync(r => r.Name == name);
    }

    public async Task<IEnumerable<Role>> GetByNamesAsync(IEnumerable<string> names)
    {
        return await _dbSet.Where(r => names.Contains(r.Name)).ToListAsync();
    }
}

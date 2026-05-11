using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.Interfaces;

public interface IBannedUserCache
{
    void AddBannedUser(Guid userId);
    bool IsBanned(Guid userId);
    void Remove(Guid userId);
    void Populate(IEnumerable<Guid> bannedUserIds);
}

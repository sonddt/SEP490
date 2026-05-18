using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.DAL.Repositories.Interfaces;

public interface ISocialRepository
{
    Task<UserPrivacySettings?> GetPrivacyAsync(Guid userId, CancellationToken ct = default);
    Task AddPrivacyAsync(UserPrivacySettings privacy, CancellationToken ct = default);
    Task UpdatePrivacyAsync(UserPrivacySettings privacy, CancellationToken ct = default);

    Task<IEnumerable<FriendRequest>> GetPendingRequestsBetweenAsync(Guid userA, Guid userB, CancellationToken ct = default);
    Task<FriendRequest?> GetPendingRequestAsync(Guid fromUserId, Guid toUserId, CancellationToken ct = default);
    Task<FriendRequest?> GetFriendRequestByIdAsync(Guid requestId, CancellationToken ct = default);
    Task AddRequestAsync(FriendRequest request, CancellationToken ct = default);
    Task UpdateRequestAsync(FriendRequest request, CancellationToken ct = default);
    Task UpdateRequestsAsync(IEnumerable<FriendRequest> requests, CancellationToken ct = default);
    Task<IEnumerable<FriendRequest>> GetIncomingRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<IEnumerable<FriendRequest>> GetSentRequestsAsync(Guid userId, CancellationToken ct = default);

    Task<bool> FriendshipExistsAsync(Guid userLowId, Guid userHighId, CancellationToken ct = default);
    Task<Friendship?> GetFriendshipAsync(Guid userLowId, Guid userHighId, CancellationToken ct = default);
    Task AddFriendshipAsync(Friendship friendship, CancellationToken ct = default);
    Task RemoveFriendshipAsync(Friendship friendship, CancellationToken ct = default);
    Task<IEnumerable<Guid>> GetFriendIdsAsync(Guid userId, CancellationToken ct = default);

    Task<bool> IsEitherBlockedAsync(Guid userA, Guid userB, CancellationToken ct = default);
    Task<IEnumerable<Guid>> GetBlockedUserIdsAsync(Guid userId, CancellationToken ct = default);
    Task<UserBlock?> GetBlockAsync(Guid blockerId, Guid blockedId, CancellationToken ct = default);
    Task<bool> IsBlockedByMeAsync(Guid me, Guid other, CancellationToken ct = default);
    Task<bool> IsBlockedByThemAsync(Guid me, Guid other, CancellationToken ct = default);
    Task AddBlockAsync(UserBlock block, CancellationToken ct = default);
    Task RemoveBlockAsync(UserBlock block, CancellationToken ct = default);

    Task<User?> SearchExactEmailAsync(string email, CancellationToken ct = default);
    Task<User?> SearchExactPhoneAsync(string digits, CancellationToken ct = default);
    Task<IEnumerable<User>> SearchByNameAsync(string term, IEnumerable<Guid> blockedIds, Guid currentUserId, int take, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

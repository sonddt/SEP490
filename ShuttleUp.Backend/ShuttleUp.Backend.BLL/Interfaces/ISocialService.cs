using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ShuttleUp.BLL.DTOs.Social;

namespace ShuttleUp.BLL.Interfaces;

public interface ISocialService
{
    Task<PrivacyDto> GetPrivacyAsync(Guid userId, CancellationToken ct = default);
    Task<PrivacyDto> UpdatePrivacyAsync(Guid userId, PrivacyDto dto, CancellationToken ct = default);
    
    Task<IEnumerable<UserSearchDto>> SearchExactAsync(Guid currentUserId, string query, CancellationToken ct = default);
    Task<IEnumerable<UserSearchDto>> SearchByNameAsync(Guid currentUserId, string query, int take = 15, CancellationToken ct = default);
    
    Task<AcceptRequestResponseDto> SendFriendRequestAsync(Guid currentUserId, Guid toUserId, CancellationToken ct = default);
    Task CancelSentRequestAsync(Guid currentUserId, Guid toUserId, CancellationToken ct = default);
    Task AcceptRequestAsync(Guid currentUserId, Guid requestId, CancellationToken ct = default);
    Task DeclineRequestAsync(Guid currentUserId, Guid requestId, CancellationToken ct = default);
    
    Task<IEnumerable<FriendRequestDto>> GetIncomingRequestsAsync(Guid userId, CancellationToken ct = default);
    Task<IEnumerable<FriendRequestDto>> GetSentRequestsAsync(Guid userId, CancellationToken ct = default);
    
    Task<IEnumerable<FriendDto>> GetFriendsAsync(Guid userId, CancellationToken ct = default);
    Task UnfriendAsync(Guid currentUserId, Guid friendUserId, CancellationToken ct = default);
    
    Task BlockUserAsync(Guid currentUserId, Guid blockedUserId, CancellationToken ct = default);
    Task UnblockUserAsync(Guid currentUserId, Guid blockedUserId, CancellationToken ct = default);
    
    Task<RelationshipStateDto> GetRelationshipAsync(Guid currentUserId, Guid otherUserId, CancellationToken ct = default);
}

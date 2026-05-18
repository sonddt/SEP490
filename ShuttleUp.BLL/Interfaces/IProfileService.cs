using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using ShuttleUp.BLL.DTOs.Profile;

namespace ShuttleUp.BLL.Interfaces;

public interface IProfileService
{
    Task<MyProfileDetailsDto?> GetMyProfileAsync(Guid userId);
    Task<PublicProfileDto?> GetPublicProfileAsync(Guid targetUserId, Guid viewerId);
    Task<object> UpdateMyProfileAsync(Guid userId, UpdateProfileDto dto);
    Task<string> UploadAvatarAsync(Guid userId, IFormFile avatar, CancellationToken cancellationToken = default);
}

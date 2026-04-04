using Microsoft.AspNetCore.Http;

namespace ShuttleUp.Backend.Services.Interfaces;

public interface IFileService
{
    Task<FileUploadResult> UploadAvatarAsync(IFormFile file, Guid userId, CancellationToken cancellationToken = default);

    Task<FileUploadResult> UploadPaymentProofAsync(IFormFile file, Guid bookingId, CancellationToken cancellationToken = default);

    Task<FileUploadResult> UploadMatchingCommentImageAsync(IFormFile file, Guid postId, Guid userId, CancellationToken cancellationToken = default);

    Task<FileUploadResult> UploadChatImageAsync(IFormFile file, Guid roomId, Guid userId, CancellationToken cancellationToken = default);

    Task<FileUploadResult> UploadFeaturedPostImageAsync(IFormFile file, Guid authorId, CancellationToken cancellationToken = default);
}

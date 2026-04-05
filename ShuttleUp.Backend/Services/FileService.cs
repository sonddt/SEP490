using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Services;

public class FileService : IFileService
{
    private readonly Cloudinary _cloudinary;
    private readonly CloudinarySettings _settings;

    public FileService(Cloudinary cloudinary, IOptions<CloudinarySettings> options)
    {
        _cloudinary = cloudinary;
        _settings = options.Value;
    }

    public async Task<FileUploadResult> UploadAvatarAsync(IFormFile file, Guid userId, CancellationToken cancellationToken = default)
    {
        var publicId = $"user_avatar_{userId}";
        var folder = ResolveFolder(_settings.AvatarFolder);

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
            PublicId = publicId,
            Overwrite = true,
            Invalidate = true,
            Transformation = new Transformation()
                .Crop("fill")
                .Gravity("face")
                .Width(200)
                .Height(200)
                .FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);
        return MapUploadResult(result);
    }

    public async Task<FileUploadResult> UploadPaymentProofAsync(IFormFile file, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var publicId = $"payment_{bookingId}_{Guid.NewGuid():N}";
        var folder = ResolveFolder(_settings.PaymentProofFolder);

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
            PublicId = publicId,
            Overwrite = false,
            Transformation = new Transformation()
                .Crop("limit")
                .Width(1600)
                .Height(1600)
                .FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);
        return MapUploadResult(result);
    }

    public async Task<FileUploadResult> UploadMatchingCommentImageAsync(IFormFile file, Guid postId, Guid userId, CancellationToken cancellationToken = default)
    {
        var publicId = $"match_comment_{postId:N}_{userId:N}_{Guid.NewGuid():N}";
        var folder = ResolveFolder(_settings.MatchingCommentFolder);

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
            PublicId = publicId,
            Overwrite = false,
            Transformation = new Transformation()
                .Crop("limit")
                .Width(1200)
                .Height(1200)
                .FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);
        return MapUploadResult(result);
    }

    public async Task<FileUploadResult> UploadChatImageAsync(IFormFile file, Guid roomId, Guid userId, CancellationToken cancellationToken = default)
    {
        var publicId = $"chat_{roomId:N}_{userId:N}_{Guid.NewGuid():N}";
        var folder = ResolveFolder(_settings.ChatAttachmentFolder);

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
            PublicId = publicId,
            Overwrite = false,
            Transformation = new Transformation()
                .Crop("limit")
                .Width(1200)
                .Height(1200)
                .FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);
        return MapUploadResult(result);
    }

    public async Task<FileUploadResult> UploadFeaturedPostImageAsync(IFormFile file, Guid authorId, CancellationToken cancellationToken = default)
    {
        var publicId = $"featured_{authorId:N}_{Guid.NewGuid():N}";
        var folder = ResolveFolder(_settings.FeaturedPostImageFolder);

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
            PublicId = publicId,
            Overwrite = false,
            Transformation = new Transformation()
                .Crop("limit")
                .Width(1600)
                .Height(900)
                .FetchFormat("webp")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);
        return MapUploadResult(result);
    }

    private static FileUploadResult MapUploadResult(ImageUploadResult result)
    {
        if (result == null)
            throw new InvalidOperationException("Upload Cloudinary thất bại: result null.");

        if (result.Error != null)
            throw new InvalidOperationException($"Upload Cloudinary thất bại: {result.Error.Message}");

        var secureUrl = result.SecureUrl?.ToString();
        if (string.IsNullOrWhiteSpace(secureUrl))
            throw new InvalidOperationException("Upload Cloudinary thất bại: SecureUrl is null.");

        return new FileUploadResult
        {
            SecureUrl = secureUrl,
            PublicId = result.PublicId ?? string.Empty
        };
    }

    private string ResolveFolder(string preferredFolder)
    {
        if (!string.IsNullOrWhiteSpace(preferredFolder))
            return preferredFolder.Trim();

        if (!string.IsNullOrWhiteSpace(_settings.Folder))
            return _settings.Folder.Trim();

        return "uploads";
    }
}

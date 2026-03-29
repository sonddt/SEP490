namespace ShuttleUp.Backend.Configurations;

/// <summary>
/// Bắt buộc cấu hình đầy đủ (CloudName, ApiKey, ApiSecret) — API không khởi động nếu thiếu; upload chứng từ CK dùng Cloudinary.
/// </summary>
public class CloudinarySettings
{
    public string CloudName { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    public string ApiSecret { get; set; } = string.Empty;

    public string Folder { get; set; } = "uploads";

    public string AvatarFolder { get; set; } = "avatars";

    public string PaymentProofFolder { get; set; } = "payment_proofs";

    public string MatchingCommentFolder { get; set; } = "matching_comments";
}

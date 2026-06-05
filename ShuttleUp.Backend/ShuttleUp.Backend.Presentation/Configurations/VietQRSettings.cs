namespace ShuttleUp.Backend.Configurations;

/// <summary>
/// Bắt buộc cấu hình ClientId + ApiKey (qua user-secrets hoặc env) — API không khởi động nếu thiếu;
/// tra cứu chủ tài khoản ngân hàng dùng VietQR Lookup API.
/// </summary>
public class VietQRSettings
{
    public string ClientId { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    public string LookupUrl { get; set; } = "https://api.vietqr.io/v2/lookup";
}

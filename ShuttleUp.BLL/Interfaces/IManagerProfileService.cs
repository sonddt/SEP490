namespace ShuttleUp.BLL.Interfaces;

public interface IManagerProfileService
{
    Task<object?> GetProfileAsync(Guid userId);
    Task<object> UpdateProfileAsync(Guid userId, ManagerProfileUpdateParams updateParams);
}

/// <summary>
/// Parameters cho cập nhật hồ sơ manager — Controller chuyển IFormFile thành các stream/metadata trước khi gọi.
/// </summary>
public class ManagerProfileUpdateParams
{
    public string? TaxCode { get; set; }
    public string? Address { get; set; }

    // CCCD files (đã chuyển từ IFormFile)
    public FileUploadParam? CccdFrontFile { get; set; }
    public FileUploadParam? CccdBackFile { get; set; }

    // Business license files
    public List<FileUploadParam>? BusinessLicenseFiles { get; set; }

    // Retained license IDs (comma-separated string from form)
    public string? RetainedLicenseIds { get; set; }
}

/// <summary>
/// Đại diện cho một file upload — Controller tạo từ IFormFile, Service không biết về IFormFile.
/// </summary>
public class FileUploadParam
{
    public Stream Stream { get; set; } = null!;
    public string FileName { get; set; } = "";
    public string? ContentType { get; set; }
    public long Length { get; set; }
}

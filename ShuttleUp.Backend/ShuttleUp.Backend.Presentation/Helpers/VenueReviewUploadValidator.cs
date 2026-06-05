namespace ShuttleUp.Backend.Helpers;

/// <summary>Kiểm tra dung lượng và “magic bytes” JPEG/PNG/WebP trước khi gửi Cloudinary.</summary>
public static class VenueReviewUploadValidator
{
    public const long MaxBytes = 2_500_000;

    public static bool TryValidateImageHeader(Stream stream, out string? error)
    {
        error = null;
        if (!stream.CanSeek)
            return true;

        var pos = stream.Position;
        try
        {
            var buf = new byte[16];
            var n = stream.Read(buf, 0, buf.Length);
            if (n < 2)
            {
                error = "File ảnh không hợp lệ.";
                return false;
            }

            if (buf[0] == 0xFF && buf[1] == 0xD8)
                return true;

            if (n >= 8 && buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4E && buf[3] == 0x47)
                return true;

            // WebP: RIFF....WEBP
            if (n >= 12 && buf[0] == 0x52 && buf[1] == 0x49 && buf[2] == 0x46 && buf[3] == 0x46
                && n >= 12 && buf[8] == 0x57 && buf[9] == 0x45 && buf[10] == 0x42 && buf[11] == 0x50)
                return true;

            error = "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.";
            return false;
        }
        finally
        {
            stream.Position = pos;
        }
    }
}

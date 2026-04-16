using System.Collections.Generic;
using System.Threading.Tasks;

namespace ShuttleUp.Backend.Services.Interfaces;

public interface IEmailTemplateService
{
    /// <summary>
    /// Đọc file template HTML và thay thế các placeholder {{Key}} bằng Value.
    /// </summary>
    /// <param name="templateName">Tên file (vd: HardBanNotification)</param>
    /// <param name="placeholders">Từ điển các giá trị cần thay thế</param>
    Task<string> GetTemplateAsync(string templateName, Dictionary<string, string> placeholders);
}

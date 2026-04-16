using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using ShuttleUp.Backend.Services.Interfaces;

namespace ShuttleUp.Backend.Services;

public class EmailTemplateService : IEmailTemplateService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<EmailTemplateService> _logger;
    private readonly string _templateBasePath;

    public EmailTemplateService(IWebHostEnvironment env, ILogger<EmailTemplateService> logger)
    {
        _env = env;
        _logger = logger;
        // Đường dẫn tới thư mục Templates/Emails trong output directory
        _templateBasePath = Path.Combine(_env.ContentRootPath, "Templates", "Emails");
    }

    public async Task<string> GetTemplateAsync(string templateName, Dictionary<string, string> placeholders)
    {
        try
        {
            var fileName = templateName.EndsWith(".html") ? templateName : $"{templateName}.html";
            var filePath = Path.Combine(_templateBasePath, fileName);

            if (!File.Exists(filePath))
            {
                _logger.LogError("Email template not found at: {FilePath}", filePath);
                return string.Empty;
            }

            // Đọc nội dung file (Encoding mặc định là UTF-8 trong .NET Core)
            string content = await File.ReadAllTextAsync(filePath);

            // Thay thế các placeholder
            if (placeholders != null)
            {
                foreach (var item in placeholders)
                {
                    content = content.Replace($"{{{{{item.Key}}}}}", item.Value ?? "");
                }
            }

            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading email template: {TemplateName}", templateName);
            return string.Empty;
        }
    }
}

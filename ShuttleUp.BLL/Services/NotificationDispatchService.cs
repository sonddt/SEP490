using System.Text.Json;
using Microsoft.Extensions.Logging;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class NotificationDispatchService : INotificationDispatchService
{
    private readonly IUserNotificationRepository _notifRepo;
    private readonly IUserRepository _userRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ISignalRNotifier _notifier;
    private readonly IEmailService _email;
    private readonly ILogger<NotificationDispatchService> _logger;

    public NotificationDispatchService(
        IUserNotificationRepository notifRepo,
        IUserRepository userRepo,
        IUnitOfWork unitOfWork,
        ISignalRNotifier notifier,
        IEmailService email,
        ILogger<NotificationDispatchService> logger)
    {
        _notifRepo = notifRepo;
        _userRepo = userRepo;
        _unitOfWork = unitOfWork;
        _notifier = notifier;
        _email = email;
        _logger = logger;
    }

    public async Task NotifyUserAsync(
        Guid userId,
        string type,
        string title,
        string? body,
        object? metadata = null,
        bool sendEmail = false,
        object? bookingStatusPayload = null,
        string? htmlBodyOverride = null,
        CancellationToken cancellationToken = default)
    {
        var metaJson = metadata == null ? null : JsonSerializer.Serialize(metadata);

        var entity = new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = string.IsNullOrWhiteSpace(type) ? "SYSTEM" : type.Trim(),
            Title = title,
            Body = body,
            MetadataJson = metaJson,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };

        await _notifRepo.AddAsync(entity, saveChanges: false);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        Guid? bookingIdFromMeta = TryGetBookingId(metaJson);

        await _notifier.SendNotificationAsync(userId, new
        {
            id = entity.Id,
            type = entity.Type,
            title = entity.Title,
            body = entity.Body,
            createdAt = entity.CreatedAt,
            bookingId = bookingIdFromMeta,
        }, cancellationToken);

        if (bookingStatusPayload != null)
        {
            await _notifier.SendBookingStatusAsync(userId, bookingStatusPayload, cancellationToken);
        }

        if (!sendEmail)
            return;

        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null || string.IsNullOrWhiteSpace(user.Email))
            return;

        try
        {
            string emailHtml;
            if (!string.IsNullOrWhiteSpace(htmlBodyOverride))
            {
                emailHtml = htmlBodyOverride;
            }
            else
            {
                var safeBody = string.IsNullOrWhiteSpace(body) ? "" : $"<p style=\"margin:12px 0;color:#334155\">{System.Net.WebUtility.HtmlEncode(body)}</p>";
                emailHtml = $"""
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
                      <h2 style="color:#097E52">ShuttleUp</h2>
                      <p style="font-size:16px;font-weight:600;color:#1e293b">{System.Net.WebUtility.HtmlEncode(title)}</p>
                      {safeBody}
                      <p style="color:#94a3b8;font-size:12px">Bạn nhận được email này vì có hoạt động liên quan tài khoản ShuttleUp.</p>
                    </div>
                    """;
            }

            await _email.SendHtmlEmailAsync(user.Email, user.FullName, $"[ShuttleUp] {title}", emailHtml);
            _logger.LogInformation("Email dispatched successfully to {Email} — subject: {Subject}", user.Email, title);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gửi email thông báo thất bại cho {UserId} ({Email})", userId, user.Email);
        }
    }

    private static Guid? TryGetBookingId(string? metaJson)
    {
        if (string.IsNullOrWhiteSpace(metaJson))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(metaJson);
            if (!doc.RootElement.TryGetProperty("bookingId", out var p))
                return null;
            if (p.ValueKind == JsonValueKind.String && Guid.TryParse(p.GetString(), out var g))
                return g;
        }
        catch
        {
            /* ignore */
        }

        return null;
    }
}

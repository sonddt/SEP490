using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ShuttleUp.Backend.Hubs;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

public class NotificationDispatchService : INotificationDispatchService
{
    private readonly ShuttleUpDbContext _db;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly IEmailService _email;
    private readonly ILogger<NotificationDispatchService> _logger;

    public NotificationDispatchService(
        ShuttleUpDbContext db,
        IHubContext<NotificationHub> hub,
        IEmailService email,
        ILogger<NotificationDispatchService> logger)
    {
        _db = db;
        _hub = hub;
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

        _db.UserNotifications.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        Guid? bookingIdFromMeta = TryGetBookingId(metaJson);

        var group = $"user-{userId}";
        await _hub.Clients.Group(group).SendAsync(
            "notification",
            new
            {
                id = entity.Id,
                type = entity.Type,
                title = entity.Title,
                body = entity.Body,
                createdAt = entity.CreatedAt,
                bookingId = bookingIdFromMeta,
            },
            cancellationToken);

        if (bookingStatusPayload != null)
        {
            await _hub.Clients.Group(group).SendAsync("bookingStatus", bookingStatusPayload, cancellationToken);
        }

        if (!sendEmail)
            return;

        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null || string.IsNullOrWhiteSpace(user.Email))
            return;

        try
        {
            // If caller provided a pre-built HTML template, use it directly
            // to avoid double-encoding rich HTML content.
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

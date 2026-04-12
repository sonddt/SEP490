using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ShuttleUp.Backend.Constants;
using ShuttleUp.Backend.Services.Interfaces;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Services;

/// <summary>
/// Background job chạy ngầm mỗi N phút, quét các BookingItem sắp diễn ra
/// (trong vòng X giờ) và gửi nhắc nhở Email + In-app cho người chơi.
/// Giá trị X và N đọc từ appsettings "ReminderSettings".
/// </summary>
public sealed class UpcomingBookingReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<UpcomingBookingReminderService> _logger;
    private readonly IConfiguration _configuration;

    // Vietnam timezone for user-friendly display in emails
    private static readonly TimeZoneInfo VnTz =
        TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()
            ? "SE Asia Standard Time"
            : "Asia/Ho_Chi_Minh");

    public UpcomingBookingReminderService(
        IServiceScopeFactory scopeFactory,
        ILogger<UpcomingBookingReminderService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pollMinutes = _configuration.GetValue("ReminderSettings:PollIntervalMinutes", 5);
        var interval = TimeSpan.FromMinutes(pollMinutes);

        _logger.LogInformation(
            "UpcomingBookingReminderService started — polling every {Mins} min", pollMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendUpcomingRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpcomingBookingReminderService");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    private async Task SendUpcomingRemindersAsync(CancellationToken ct)
    {
        var upcomingHours = _configuration.GetValue("ReminderSettings:UpcomingHours", 2);
        var now = DateTime.UtcNow;
        var horizon = now.AddHours(upcomingHours);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShuttleUpDbContext>();
        var notifier = scope.ServiceProvider.GetRequiredService<INotificationDispatchService>();

        // Lấy các booking item CONFIRMED, chưa gửi reminder, sắp diễn ra
        var items = await db.BookingItems
            .Include(bi => bi.Booking)
                .ThenInclude(b => b!.Venue)
            .Include(bi => bi.Booking)
                .ThenInclude(b => b!.User)
            .Include(bi => bi.Court)
            .Where(bi =>
                bi.Booking != null
                && bi.Booking.Status == "CONFIRMED"
                && bi.StartTime != null
                && bi.StartTime > now
                && bi.StartTime <= horizon
                && !bi.IsUpcomingReminderSent)
            .ToListAsync(ct);

        if (items.Count == 0) return;

        _logger.LogInformation("Found {Count} upcoming booking items to remind", items.Count);

        // Nhóm theo BookingId để gửi 1 thông báo duy nhất cho mỗi đơn (nhiều khung giờ)
        var groups = items.GroupBy(i => i.BookingId);

        foreach (var group in groups)
        {
            var firstItem = group.First();
            var booking = firstItem.Booking!;
            var user = booking.User;
            var venue = booking.Venue;

            if (user == null || venue == null) continue;

            var vnStart = TimeZoneInfo.ConvertTimeFromUtc(firstItem.StartTime!.Value, VnTz);
            var courtNames = string.Join(", ",
                group.Select(i => i.Court?.Name ?? "Sân").Distinct());

            var title = $"⏰ Sắp đến giờ đánh cầu!";
            var body = $"Lịch đặt tại {venue.Name} ({courtNames}) sẽ bắt đầu lúc "
                     + $"{vnStart:HH:mm} ngày {vnStart:dd/MM/yyyy}. Chúc bạn thi đấu vui vẻ!";

            var frontendUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";
            var detailLink = $"{frontendUrl}/user/bookings?bookingId={booking.Id}";

            // Build HTML email
            var htmlBody = $"""
                <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                  <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                    <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Nhắc nhở lịch đánh cầu</p>
                  </div>
                  <div style="padding:24px">
                    <p style="color:#334155;font-size:15px;margin:0 0 16px">
                      Xin chào <strong>{System.Net.WebUtility.HtmlEncode(user.FullName ?? user.Email ?? "bạn")}</strong>,
                    </p>
                    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
                      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
                        <tr>
                          <td style="padding:6px 0;font-weight:600;width:120px">📍 Sân:</td>
                          <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(venue.Name ?? "")}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;font-weight:600">🏟️ Court:</td>
                          <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(courtNames)}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;font-weight:600">🕐 Giờ bắt đầu:</td>
                          <td style="padding:6px 0"><strong>{vnStart:HH:mm}</strong> — {vnStart:dd/MM/yyyy}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align:center;margin:20px 0">
                      <a href="{detailLink}"
                         style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;
                                border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                        Xem chi tiết đơn đặt sân
                      </a>
                    </div>
                    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center">
                      Bạn nhận được email này vì có lịch đánh cầu sắp tới trên ShuttleUp.
                    </p>
                  </div>
                </div>
                """;

            try
            {
                // Gửi in-app notification + email (dùng htmlBodyOverride để tránh double-encode)
                await notifier.NotifyUserAsync(
                    user.Id,
                    NotificationTypes.UpcomingBooking,
                    title,
                    body,
                    metadata: new { bookingId = booking.Id, venueId = venue.Id },
                    sendEmail: true,
                    htmlBodyOverride: htmlBody,
                    cancellationToken: ct);

                // Đánh cờ đã gửi cho tất cả item trong nhóm
                foreach (var item in group)
                {
                    item.IsUpcomingReminderSent = true;
                }

                _logger.LogInformation(
                    "Sent upcoming reminder for booking {BookingId} to user {UserId}",
                    booking.Id, user.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to send upcoming reminder for booking {BookingId}", booking.Id);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}

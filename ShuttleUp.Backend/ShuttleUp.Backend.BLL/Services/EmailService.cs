using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.BLL.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink)
    {
        var smtpHost = _configuration["Email:SmtpHost"];

        // Nếu chưa cấu hình SMTP → log ra console thay vì gửi email
        if (string.IsNullOrEmpty(smtpHost))
        {
            _logger.LogWarning("==== [DEV] Password Reset Link ====");
            _logger.LogWarning("To: {Email}", toEmail);
            _logger.LogWarning("Link: {Link}", resetLink);
            _logger.LogWarning("===================================");
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
            _configuration["Email:SenderName"] ?? "ShuttleUp",
            _configuration["Email:SenderEmail"]!));
        message.To.Add(new MailboxAddress(fullName, toEmail));
        message.Subject = "[ShuttleUp] Đặt lại mật khẩu";

        var body = new BodyBuilder
        {
            HtmlBody = $"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
                  <h2 style="color:#1a1a2e">Đặt lại mật khẩu ShuttleUp</h2>
                  <p>Xin chào <strong>{fullName}</strong>,</p>
                  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                  <p>Nhấn vào nút bên dưới để đặt mật khẩu mới. Link có hiệu lực trong <strong>15 phút</strong>.</p>
                  <a href="{resetLink}"
                     style="display:inline-block;padding:12px 28px;background:#28a745;color:#fff;
                            border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">
                    Đặt lại mật khẩu
                  </a>
                  <p style="color:#888;font-size:13px">
                    Nếu bạn không yêu cầu, hãy bỏ qua email này.<br/>
                    Link: <a href="{resetLink}">{resetLink}</a>
                  </p>
                </div>
                """
        };
        message.Body = body.ToMessageBody();

        using var client = new SmtpClient();
        client.CheckCertificateRevocation = false;
        await client.ConnectAsync(
            smtpHost,
            int.Parse(_configuration["Email:SmtpPort"] ?? "587"),
            SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(
            _configuration["Email:Username"]!,
            _configuration["Email:Password"]!);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    public async Task SendHtmlEmailAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var smtpHost = _configuration["Email:SmtpHost"];

        if (string.IsNullOrEmpty(smtpHost))
        {
            _logger.LogWarning("==== [DEV] HTML Email (SMTP chưa cấu hình) ====");
            _logger.LogWarning("To: {Email}", toEmail);
            _logger.LogWarning("Subject: {Subject}", subject);
            _logger.LogWarning("===============================================");
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
            _configuration["Email:SenderName"] ?? "ShuttleUp",
            _configuration["Email:SenderEmail"]!));
        message.To.Add(new MailboxAddress(string.IsNullOrWhiteSpace(toName) ? toEmail : toName, toEmail));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        client.CheckCertificateRevocation = false;
        await client.ConnectAsync(
            smtpHost,
            int.Parse(_configuration["Email:SmtpPort"] ?? "587"),
            SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(
            _configuration["Email:Username"]!,
            _configuration["Email:Password"]!);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}

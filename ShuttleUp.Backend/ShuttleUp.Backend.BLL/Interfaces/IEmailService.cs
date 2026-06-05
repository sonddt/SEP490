namespace ShuttleUp.BLL.Interfaces;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink);

    /// <summary>Gửi email HTML tùy chỉnh (thông báo hệ thống). Nếu chưa cấp SMTP thì log DEV.</summary>
    Task SendHtmlEmailAsync(string toEmail, string toName, string subject, string htmlBody);
}

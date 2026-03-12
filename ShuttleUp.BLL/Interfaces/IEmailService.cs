namespace ShuttleUp.BLL.Interfaces;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink);
}

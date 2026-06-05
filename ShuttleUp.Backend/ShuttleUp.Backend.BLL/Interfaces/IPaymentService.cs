using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IPaymentService
{
    Task<Payment?> GetByIdAsync(Guid id);
    Task<IEnumerable<Payment>> GetByBookingAsync(Guid bookingId);
    Task<IEnumerable<Payment>> GetByStatusAsync(string status);
    Task CreateAsync(Payment payment);
    Task ConfirmAsync(Guid paymentId, Guid confirmedBy);
    Task<RefundRequest> RequestRefundAsync(Guid bookingId, Guid userId);
    Task ProcessRefundAsync(Guid refundRequestId, Guid processedBy);
}

using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;

namespace ShuttleUp.BLL.Services;

public class PaymentService : IPaymentService
{
    private readonly IPaymentRepository _paymentRepository;

    public PaymentService(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<Payment?> GetByIdAsync(Guid id)
        => await _paymentRepository.GetByIdAsync(id);

    public async Task<IEnumerable<Payment>> GetByBookingAsync(Guid bookingId)
        => await _paymentRepository.GetByBookingAsync(bookingId);

    public async Task<IEnumerable<Payment>> GetByStatusAsync(string status)
        => await _paymentRepository.GetByStatusAsync(status);

    public async Task CreateAsync(Payment payment)
    {
        payment.Id = Guid.NewGuid();
        payment.CreatedAt = DateTime.UtcNow;
        payment.Status = "PENDING";
        await _paymentRepository.AddAsync(payment);
    }

    public async Task ConfirmAsync(Guid paymentId, Guid confirmedBy)
    {
        var payment = await _paymentRepository.GetByIdAsync(paymentId);
        if (payment == null) return;
        payment.Status = "CONFIRMED";
        payment.ConfirmedBy = confirmedBy;
        payment.ConfirmedAt = DateTime.UtcNow;
        await _paymentRepository.UpdateAsync(payment);
    }

    public async Task<RefundRequest> RequestRefundAsync(Guid bookingId, Guid userId)
    {
        var refund = new RefundRequest
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            UserId = userId,
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow
        };
        return refund;
    }

    public async Task ProcessRefundAsync(Guid refundRequestId, Guid processedBy)
    {
        // TODO: implement refund processing logic
        await Task.CompletedTask;
    }
}

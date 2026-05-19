using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.BLL.Constants;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ShuttleUp.BLL.Services;

public class BookingService : IBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly ShuttleUpDbContext _dbContext;
    private readonly INotificationDispatchService _notify;
    private readonly IMatchingPostLifecycleService _matchingPostLifecycle;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;

    public BookingService(
        IBookingRepository bookingRepository,
        ShuttleUpDbContext dbContext,
        INotificationDispatchService notify,
        IMatchingPostLifecycleService matchingPostLifecycle,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration)
    {
        _bookingRepository = bookingRepository;
        _dbContext = dbContext;
        _notify = notify;
        _matchingPostLifecycle = matchingPostLifecycle;
        _scopeFactory = scopeFactory;
        _configuration = configuration;
    }

    public async Task<Booking?> GetByIdAsync(Guid id)
        => await _bookingRepository.GetByIdAsync(id);

    public async Task<IEnumerable<Booking>> GetAllAsync()
        => await _bookingRepository.GetAllAsync();

    public async Task<IEnumerable<Booking>> GetByUserAsync(Guid userId)
        => await _bookingRepository.GetByUserAsync(userId);

    public async Task<IEnumerable<Booking>> GetByVenueAsync(Guid venueId)
        => await _bookingRepository.GetByVenueAsync(venueId);

    public async Task<IEnumerable<Booking>> GetByStatusAsync(string status)
        => await _bookingRepository.GetByStatusAsync(status);

    public async Task CreateAsync(Booking booking)
    {
        booking.Id = Guid.NewGuid();
        booking.CreatedAt = DateTime.UtcNow;
        booking.Status = "PENDING";
        await _bookingRepository.AddAsync(booking);
    }

    public async Task UpdateAsync(Booking booking)
        => await _bookingRepository.UpdateAsync(booking);

    public async Task CancelAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CANCELLED";
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task ConfirmAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId);
        if (booking == null) return;
        booking.Status = "CONFIRMED";
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task<BookingResponseDto> CancelHoldAsync(Guid bookingId, Guid userId, CancellationToken ct)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.UserId != userId)
            throw new UnauthorizedAccessException();

        if (booking.Status != "HOLDING")
            throw new ArgumentException("Chỉ có thể huỷ đơn đang giữ chỗ (HOLDING).");

        booking.Status = "CANCELLED";
        booking.HoldExpiresAt = null;

        foreach (var item in booking.BookingItems)
            item.Status = "CANCELLED";

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
            if (series != null)
                series.Status = "CANCELLED";
        }

        if (booking.CouponId.HasValue)
        {
            var coupon = await _dbContext.VenueCoupons.FirstOrDefaultAsync(c => c.Id == booking.CouponId.Value, ct);
            if (coupon != null && (coupon.UsedCount ?? 0) > 0)
                coupon.UsedCount = (coupon.UsedCount ?? 0) - 1;
        }

        await _dbContext.SaveChangesAsync(ct);

        return new BookingResponseDto
        {
            BookingId = booking.Id,
            Status = booking.Status,
        };
    }

    private static (bool hasProof, bool paymentConfirmed, decimal paidAmount) AnalyzePaymentState(ICollection<Payment> payments)
    {
        var hasProof = payments.Any(p =>
            p.GatewayReference != null
            && p.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase));
        var paymentConfirmed = payments.Any(p =>
            p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase));
        var paidAmount = payments
            .Where(p => p.Status != null && p.Status.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount ?? 0);
        return (hasProof, paymentConfirmed, paidAmount);
    }

    public async Task<(string Message, string Status, string CancelBranch, Guid? RefundRequestId)> CancelMyBookingAsync(
        Guid bookingId, Guid userId, CancelBookingBodyDto? body, CancellationToken ct)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.BookingItems)
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId, ct);

        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.Status is "CANCELLED" or "PENDING_RECONCILIATION" or "PENDING_REFUND" or "REFUNDED")
            throw new ArgumentException("Đơn đã bị huỷ hoặc đang xử lý hoàn tiền.");

        if (booking.Status is not ("PENDING" or "CONFIRMED"))
            throw new ArgumentException("Không thể huỷ đơn ở trạng thái này.");

        var policySnapshot = string.IsNullOrWhiteSpace(booking.CancellationPolicySnapshotJson) 
            ? new { AllowCancel = false, CancelBeforeMinutes = 0, RefundType = "NONE", RefundPercent = (int?)null }
            : JsonSerializer.Deserialize<dynamic>(booking.CancellationPolicySnapshotJson);

        var allowCancel = (bool)(policySnapshot?.AllowCancel ?? false);
        var cancelBeforeMinutes = (int)(policySnapshot?.CancelBeforeMinutes ?? 0);
        var refundType = (string?)(policySnapshot?.RefundType ?? "NONE");
        var refundPercent = (int?)(policySnapshot?.RefundPercent);

        if (!allowCancel)
            throw new ArgumentException("Theo chính sách cụm sân, bạn không thể tự huỷ đơn này. Vui lòng liên hệ chủ sân.");

        var starts = booking.BookingItems.Where(bi => bi.StartTime != null).Select(bi => bi.StartTime!.Value).ToList();
        if (starts.Count > 0)
        {
            var minStartUtc = starts.Select(x => DateTime.SpecifyKind(x, DateTimeKind.Utc)).Min();
            var deadlineUtc = minStartUtc.AddMinutes(-cancelBeforeMinutes);
            if (DateTime.UtcNow > deadlineUtc)
                throw new ArgumentException($"Đã quá thời hạn huỷ (phải huỷ trước giờ đá ít nhất {cancelBeforeMinutes} phút).");
        }

        var (hasProof, paymentConfirmed, paidAmount) = AnalyzePaymentState(booking.Payments);
        string cancelBranch;
        string newBookingStatus;
        string? refundRequestStatus = null;

        if (paymentConfirmed)
        {
            cancelBranch = "PAID";
            newBookingStatus = "PENDING_REFUND";
            refundRequestStatus = "PENDING_REFUND";
        }
        else if (hasProof)
        {
            cancelBranch = "PROOF_UPLOADED";
            newBookingStatus = "PENDING_RECONCILIATION";
            refundRequestStatus = "PENDING_RECONCILIATION";
        }
        else
        {
            cancelBranch = "NO_PAYMENT";
            newBookingStatus = "CANCELLED";
        }

        booking.Status = newBookingStatus;
        foreach (var item in booking.BookingItems)
            item.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : item.Status;

        if (newBookingStatus == "CANCELLED")
        {
            foreach (var p in booking.Payments.Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase)))
                p.Status = "CANCELLED";
        }

        if (booking.SeriesId is { } seriesId)
        {
            var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
            if (series != null)
                series.Status = newBookingStatus == "CANCELLED" ? "CANCELLED" : "CANCELLING";
        }

        RefundRequest? refundReq = null;
        if (refundRequestStatus != null)
        {
            decimal refundAmount = 0;
            if (cancelBranch == "PAID")
            {
                if (refundType == "FULL") refundAmount = paidAmount;
                else if (refundType == "PERCENT" && refundPercent.HasValue) refundAmount = paidAmount * refundPercent.Value / 100m;
            }

            refundReq = new RefundRequest
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                UserId = userId,
                ReasonCode = "PLAYER_CANCEL",
                Status = refundRequestStatus,
                RequestedAmount = refundAmount,
                PaidAmount = cancelBranch == "PAID" ? paidAmount : null,
                RefundBankName = body?.RefundBankName?.Trim(),
                RefundAccountNumber = body?.RefundAccountNumber?.Trim(),
                RefundAccountHolder = body?.RefundAccountHolder?.Trim().ToUpperInvariant(),
                RefundQrImageUrl = body?.RefundQrImageUrl?.Trim(),
                PlayerNote = body?.PlayerNote?.Trim(),
                RequestedAt = DateTime.UtcNow,
            };
            _dbContext.RefundRequests.Add(refundReq);
        }

        await using var trx = await _dbContext.Database.BeginTransactionAsync(ct);
        try
        {
            await _dbContext.SaveChangesAsync(ct);
            await trx.CommitAsync(ct);
        }
        catch
        {
            await trx.RollbackAsync(ct);
            throw;
        }

        await _matchingPostLifecycle.CancelPostsByBookingAsync(booking, cancelledBy: "người chơi", ct);

        if (booking.VenueId.HasValue)
        {
            var ownerId = await _dbContext.Venues.Where(v => v.Id == booking.VenueId).Select(v => v.OwnerUserId).FirstOrDefaultAsync(ct);
            if (ownerId.HasValue)
            {
                var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
                var title = cancelBranch switch
                {
                    "PAID" => "Yêu cầu hoàn tiền mới",
                    "PROOF_UPLOADED" => "Đơn hủy cần đối soát",
                    _ => "Đơn đặt sân bị hủy",
                };
                var notifBody = $"Đơn #{code} đã bị người chơi hủy" + cancelBranch switch
                {
                    "PAID" => " — vui lòng xử lý hoàn tiền.",
                    "PROOF_UPLOADED" => " — có chứng từ CK cần đối soát.",
                    _ => ".",
                };
                await _notify.NotifyUserAsync(
                    ownerId.Value,
                    NotificationTypes.RefundRequest,
                    title, notifBody,
                    new { bookingId = booking.Id, status = newBookingStatus, entityType = "refund", deepLink = "/manager/refunds" },
                    sendEmail: false,
                    cancellationToken: ct);
            }
        }

        var message = cancelBranch switch
        {
            "PAID" => "Đã hủy đơn. Yêu cầu hoàn tiền đã được gửi đến chủ sân.",
            "PROOF_UPLOADED" => "Đã hủy đơn. Vui lòng chờ chủ sân đối soát biên lai trước khi xử lý hoàn tiền.",
            _ => "Đã huỷ đặt sân thành công.",
        };

        return (message, newBookingStatus, cancelBranch, refundReq?.Id);
    }

    public async Task UpdateRefundBankInfoAsync(Guid bookingId, Guid userId, CancelBookingBodyDto body, CancellationToken ct)
    {
        var refund = await _dbContext.RefundRequests
            .FirstOrDefaultAsync(r => r.BookingId == bookingId && r.UserId == userId
                                      && r.Status != "COMPLETED" && r.Status != "REJECTED", ct);
        if (refund == null)
            throw new KeyNotFoundException("Không tìm thấy yêu cầu hoàn tiền.");

        if (!string.IsNullOrWhiteSpace(body.RefundBankName))
            refund.RefundBankName = body.RefundBankName.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountNumber))
            refund.RefundAccountNumber = body.RefundAccountNumber.Trim();
        if (!string.IsNullOrWhiteSpace(body.RefundAccountHolder))
            refund.RefundAccountHolder = body.RefundAccountHolder.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(body.RefundQrImageUrl))
            refund.RefundQrImageUrl = body.RefundQrImageUrl.Trim();

        await _dbContext.SaveChangesAsync(ct);
    }

    public async Task SubmitPaymentAsync(Guid bookingId, Guid userId, string method, string secureUrl, CancellationToken ct)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.Venue)
                .ThenInclude(v => v!.OwnerUser)
            .Include(b => b.Payments)
            .Include(b => b.BookingItems)
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId, ct);

        if (booking == null)
            throw new KeyNotFoundException("Không tìm thấy đơn đặt.");

        if (booking.Status == "CANCELLED")
            throw new ArgumentException("Đơn đã bị huỷ.");

        if (booking.Status is not ("PENDING" or "HOLDING"))
            throw new ArgumentException("Chỉ có thể nộp minh chứng khi đơn đang chờ duyệt hoặc đang giữ chỗ.");

        if (booking.Status == "HOLDING" && booking.HoldExpiresAt != null && booking.HoldExpiresAt <= DateTime.UtcNow)
            throw new ArgumentException("Thời gian giữ chỗ đã hết. Vui lòng đặt lại.");

        var methodNorm = string.IsNullOrWhiteSpace(method) ? "BANK" : method.Trim().ToUpperInvariant();
        var methodLabel = methodNorm == "QR" ? "QR" : "BANK_TRANSFER";

        var existingPending = booking.Payments
            .Where(p => p.Status != null && p.Status.Equals("PENDING", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        if (existingPending != null
            && !string.IsNullOrEmpty(existingPending.GatewayReference)
            && existingPending.GatewayReference.StartsWith("https", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Đơn đã có minh chứng thanh toán. Không gửi lại.");
        }

        var wasHolding = booking.Status == "HOLDING";
        if (wasHolding)
        {
            booking.Status = "PENDING";
            booking.HoldExpiresAt = null;
            foreach (var item in booking.BookingItems)
                item.Status = "PENDING";

            if (booking.SeriesId is { } seriesId)
            {
                var series = await _dbContext.BookingSeries.FirstOrDefaultAsync(s => s.Id == seriesId, ct);
                if (series != null) series.Status = "PENDING";
            }
        }

        if (existingPending != null)
        {
            existingPending.Method = methodLabel;
            existingPending.GatewayReference = secureUrl;
            existingPending.Amount = booking.FinalAmount;
            existingPending.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            var paymentRow = new Payment
            {
                Id = Guid.NewGuid(),
                BookingId = booking.Id,
                Method = methodLabel,
                Status = "PENDING",
                Amount = booking.FinalAmount,
                GatewayReference = secureUrl,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Payments.Add(paymentRow);
        }

        await _dbContext.SaveChangesAsync(ct);

        if (booking.Venue?.OwnerUserId is { } mgrId && mgrId != Guid.Empty)
        {
            var bookingCode = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();
            var capturedBookingId = booking.Id;
            var capturedContactName = booking.ContactName;
            var capturedFinalAmount = booking.FinalAmount;
            var capturedOwnerName = booking.Venue?.OwnerUser?.FullName ?? "Chủ sân";
            var capturedVenueName = booking.Venue?.Name ?? "sân";
            var capturedMgrId = mgrId;
            var capturedWasHolding = wasHolding;
            var capturedFrontUrl = _configuration["App:FrontendUrl"] ?? "http://localhost:5173";

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var notify = scope.ServiceProvider.GetRequiredService<INotificationDispatchService>();

                    var notifTitle = capturedWasHolding ? "📢 Có đơn đặt sân mới chờ duyệt" : "Có minh chứng thanh toán mới";
                    var notifBody = capturedWasHolding
                        ? $"Mã {bookingCode} — {capturedContactName} — {capturedFinalAmount:N0} VNĐ."
                        : $"Đơn {bookingCode} vừa có ảnh chứng từ từ người chơi.";
                    
                    string? newBookingHtml = null;
                    if (capturedWasHolding)
                    {
                        var mgrLink = $"{capturedFrontUrl}/manager/bookings";
                        newBookingHtml = $"""
                            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                              <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 24px;text-align:center">
                                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">🏸 ShuttleUp</h1>
                                <p style="margin:6px 0 0;color:#d1fae5;font-size:14px">Đơn đặt sân mới</p>
                              </div>
                              <div style="padding:24px">
                                <p style="color:#334155;font-size:15px;margin:0 0 16px">
                                  Xin chào <strong>{System.Net.WebUtility.HtmlEncode(capturedOwnerName)}</strong>,
                                </p>
                                <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
                                  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
                                    <tr>
                                      <td style="padding:6px 0;font-weight:600;width:130px">📋 Mã đơn:</td>
                                      <td style="padding:6px 0"><strong>{bookingCode}</strong></td>
                                    </tr>
                                    <tr>
                                      <td style="padding:6px 0;font-weight:600">👤 Khách hàng:</td>
                                      <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(capturedContactName ?? "Khách hàng")}</td>
                                    </tr>
                                    <tr>
                                      <td style="padding:6px 0;font-weight:600">📍 Sân:</td>
                                      <td style="padding:6px 0">{System.Net.WebUtility.HtmlEncode(capturedVenueName)}</td>
                                    </tr>
                                    <tr>
                                      <td style="padding:6px 0;font-weight:600">💰 Tổng tiền:</td>
                                      <td style="padding:6px 0"><strong>{capturedFinalAmount:N0} VNĐ</strong></td>
                                    </tr>
                                  </table>
                                </div>
                                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:20px">
                                  <p style="margin:0;color:#92400e;font-size:13px">⏰ Duyệt đơn nhanh trong vòng <strong>60 phút</strong> để duy trì huy hiệu <strong>Elite Owner</strong>!</p>
                                </div>
                                <div style="text-align:center;margin-top:28px">
                                  <a href="{mgrLink}" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 24px;font-size:15px;font-weight:600;border-radius:6px;display:inline-block">Duyệt Đơn Ngay</a>
                                </div>
                              </div>
                            </div>
                            """;
                    }

                    await notify.NotifyUserAsync(
                        capturedMgrId,
                        capturedWasHolding ? NotificationTypes.BookingNew : NotificationTypes.PaymentProof,
                        notifTitle,
                        notifBody,
                        new { bookingId = capturedBookingId, status = "PENDING", entityType = "booking", deepLink = "/manager/bookings" },
                        sendEmail: capturedWasHolding,
                        htmlBodyOverride: newBookingHtml
                    );
                }
                catch { }
            });
        }
    }
}

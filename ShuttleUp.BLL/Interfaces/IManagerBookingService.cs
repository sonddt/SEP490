namespace ShuttleUp.BLL.Interfaces;

public interface IManagerBookingService
{
    /// <summary>
    /// Manager duyệt hoặc từ chối đơn đặt sân.
    /// </summary>
    Task<ManagerBookingPatchResult> PatchStatusAsync(Guid bookingId, Guid managerId, string status, string? reason, CancellationToken ct);
}

public class ManagerBookingPatchResult
{
    public Guid BookingId { get; set; }
    public string BookingCode { get; set; } = null!;
    public string Status { get; set; } = null!;
    public string? Reason { get; set; }
    public string? ManagerStatusNote { get; set; }
}

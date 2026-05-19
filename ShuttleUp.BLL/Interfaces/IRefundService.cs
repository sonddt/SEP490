namespace ShuttleUp.BLL.Interfaces;

public interface IRefundService
{
    Task<RefundActionResult> ReconcileAsync(Guid refundId, Guid managerId, bool confirmed, string? reason, CancellationToken ct);
    Task<RefundActionResult> CompleteRefundAsync(Guid refundId, Guid managerId, string? managerNote, CancellationToken ct);
    Task UploadEvidenceAsync(Guid refundId, Guid managerId, Guid fileEntityId, CancellationToken ct);
}

public class RefundActionResult
{
    public string Message { get; set; } = null!;
    public string Status { get; set; } = null!;
}

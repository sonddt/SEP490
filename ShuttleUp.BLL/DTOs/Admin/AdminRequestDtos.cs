namespace ShuttleUp.BLL.DTOs.Admin;

public record ApprovalDecisionRequest(string? Note);
public record BanAccountRequest(string? Reason, bool ForceHardBan);
public record UnblockAccountRequest(bool RestoreVenues);

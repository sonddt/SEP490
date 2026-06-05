namespace ShuttleUp.BLL.DTOs.Booking;

public record SmartAllocationItemDto(
    Guid? CourtId,
    string? CourtName,
    DateTime Start,
    DateTime End,
    decimal Price,
    bool IsUnavailable,
    bool IsSwitched,
    string? SwitchReason);

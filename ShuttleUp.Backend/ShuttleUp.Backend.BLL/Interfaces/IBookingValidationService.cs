using ShuttleUp.BLL.DTOs.Booking;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace ShuttleUp.BLL.Interfaces;

public interface IBookingValidationService
{
    Task<string?> CheckSlotConflictsAsync(System.Collections.Generic.List<Guid> courtIds, System.Collections.Generic.List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems, CancellationToken ct = default, Guid? excludeBookingId = null, Guid? excludeHoldingUserId = null);
    Task<string?> CheckOpenHoursAsync(System.Collections.Generic.List<(Guid CourtId, DateTime Start, DateTime End, decimal Price)> normalizedItems, CancellationToken ct = default);
    Task<FlexibleLongTermBuildResultDto> BuildFlexibleLongTermAsync(LongTermFlexibleScheduleDto dto, Guid? currentUserId, CancellationToken ct);
    Task<LongTermBuildResultDto> BuildLongTermNormalizedAsync(LongTermScheduleDto dto, Guid? currentUserId, CancellationToken ct);
}

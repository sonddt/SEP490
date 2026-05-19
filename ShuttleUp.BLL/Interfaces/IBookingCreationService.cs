using ShuttleUp.BLL.DTOs.Booking;
using System;
using System.Threading;
using System.Threading.Tasks;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Interfaces;

public interface IBookingCreationService
{
    Task<BookingResponseDto> CreateBookingAsync(Guid userId, CreateBookingRequestDto dto, CancellationToken ct);
    Task<BookingResponseDto> UpdateHoldingBookingContactAsync(Guid bookingId, Guid userId, string contactName, string contactPhone, string? note, CancellationToken ct);
    Task<BookingResponseDto> CreateLongTermBookingAsync(Guid userId, LongTermBookingRequestDto dto, CancellationToken ct);
    Task<BookingResponseDto> CreateLongTermFlexibleBookingAsync(Guid userId, LongTermFlexibleBookingRequestDto dto, CancellationToken ct);
}

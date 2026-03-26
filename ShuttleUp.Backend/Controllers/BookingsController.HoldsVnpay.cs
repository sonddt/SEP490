using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ShuttleUp.BLL.DTOs.Booking;
using ShuttleUp.Backend;
using ShuttleUp.Backend.Configurations;
using ShuttleUp.Backend.Vnpay;
using ShuttleUp.DAL.Models;

namespace ShuttleUp.Backend.Controllers;

public partial class BookingsController
{
    private sealed record NormalizedSlot(Guid CourtId, DateTime Start, DateTime End, decimal Price);

    private async Task<(IActionResult? Fail, List<NormalizedSlot>? Slots, Dictionary<Guid, Court>? Courts)>
        TryNormalizeAndLoadCourtsAsync(Guid venueId, List<CreateBookingItemDto> items, CancellationToken ct = default)
    {
        if (items == null || items.Count == 0)
            return (BadRequest(new { message = "Vui lòng chọn ít nhất một khung giờ." }), null, null);

        var courtIds = items.Select(i => i.CourtId).Distinct().ToList();

        var courts = await _dbContext.Courts
            .Include(c => c.CourtPrices)
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == venueId && c.IsActive == true && c.Status == "ACTIVE")
            .ToListAsync(ct);

        if (courts.Count != courtIds.Count)
            return (BadRequest(new { message = "Một hoặc nhiều sân không thuộc cơ sở này." }), null, null);

        var courtById = courts.ToDictionary(c => c.Id);
        var normalizedItems = new List<NormalizedSlot>();
        foreach (var item in items)
        {
            if (item.EndTime <= item.StartTime)
                return (BadRequest(new { message = "Khung giờ không hợp lệ (end phải sau start)." }), null, null);

            if (!courtById.TryGetValue(item.CourtId, out var court))
                return (BadRequest(new { message = "Sân không hợp lệ." }), null, null);

            for (var slotStart = item.StartTime; slotStart < item.EndTime; slotStart = slotStart.AddMinutes(30))
            {
                var slotEnd = slotStart.AddMinutes(30);
                if (slotEnd > item.EndTime)
                    return (BadRequest(new { message = "Mỗi khung phải là bội số 30 phút." }), null, null);

                var price = ResolveSlotPrice(court.CourtPrices.ToList(), slotStart);
                if (price == null)
                    return (BadRequest(new { message = $"Chưa cấu hình giá cho sân {court.Name} tại {slotStart:HH:mm}." }), null, null);

                normalizedItems.Add(new NormalizedSlot(item.CourtId, slotStart, slotEnd, price.Value));
            }
        }

        return (null, normalizedItems, courtById);
    }

    private async Task<IActionResult?> TryConflictBookingsAsync(
        List<NormalizedSlot> normalized,
        List<Guid> courtIds,
        DateTime minStart,
        DateTime maxEnd,
        CancellationToken ct = default)
    {
        var existingItems = await _dbContext.BookingItems
            .AsNoTracking()
            .Include(bi => bi.Booking)
            .Where(bi => bi.CourtId != null
                         && courtIds.Contains(bi.CourtId.Value)
                         && bi.StartTime < maxEnd && bi.EndTime > minStart
                         && bi.Booking != null && bi.Booking.Status != "CANCELLED")
            .ToListAsync(ct);

        foreach (var bi in existingItems)
        {
            foreach (var ni in normalized)
            {
                if (ni.CourtId != bi.CourtId || bi.StartTime == null || bi.EndTime == null)
                    continue;
                if (bi.StartTime < ni.End && bi.EndTime > ni.Start)
                    return Conflict(new { message = "Một hoặc nhiều khung giờ vừa được người khác đặt. Vui lòng chọn lại." });
            }
        }

        return null;
    }

    private async Task<IActionResult?> TryConflictBlocksAsync(
        List<NormalizedSlot> normalized,
        List<Guid> courtIds,
        DateTime minStart,
        DateTime maxEnd,
        CancellationToken ct = default)
    {
        var blocks = await _dbContext.CourtBlocks
            .AsNoTracking()
            .Where(b => b.CourtId != null && courtIds.Contains(b.CourtId.Value)
                                            && b.StartTime < maxEnd && b.EndTime > minStart)
            .ToListAsync(ct);

        foreach (var b in blocks)
        {
            foreach (var ni in normalized)
            {
                if (ni.CourtId != b.CourtId || b.StartTime == null || b.EndTime == null)
                    continue;
                if (b.StartTime < ni.End && b.EndTime > ni.Start)
                    return Conflict(new { message = "Một số khung giờ đang bị khóa bởi chủ sân." });
            }
        }

        return null;
    }

    private async Task<IActionResult?> TryConflictHoldOthersAsync(
        Guid venueId,
        List<NormalizedSlot> normalized,
        List<Guid> courtIds,
        DateTime minStart,
        DateTime maxEnd,
        Guid? excludeHoldId,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var holdRows = await _dbContext.BookingHoldItems
            .AsNoTracking()
            .Include(hi => hi.Hold)
            .Where(hi => hi.Hold != null
                         && hi.Hold!.VenueId == venueId
                         && hi.Hold.Status == "ACTIVE"
                         && hi.Hold.ExpiresAt > now
                         && (excludeHoldId == null || hi.HoldId != excludeHoldId.Value)
                         && courtIds.Contains(hi.CourtId)
                         && hi.StartTime < maxEnd && hi.EndTime > minStart)
            .ToListAsync(ct);

        foreach (var hi in holdRows)
        {
            foreach (var ni in normalized)
            {
                if (ni.CourtId != hi.CourtId)
                    continue;
                if (hi.StartTime < ni.End && hi.EndTime > ni.Start)
                    return Conflict(new { message = "Một hoặc nhiều khung giờ đang được người khác giữ. Vui lòng chọn lại." });
            }
        }

        return null;
    }

    private async Task<IActionResult> CreateBookingFromHoldAsync(CreateBookingRequestDto dto, Guid userId)
    {
        var hold = await _dbContext.BookingHolds
            .Include(h => h.BookingHoldItems)
            .FirstOrDefaultAsync(h => h.Id == dto.HoldId!.Value);

        if (hold == null)
            return NotFound(new { message = "Không tìm thấy giữ chỗ." });

        if (hold.UserId != userId)
            return Forbid();

        if (hold.VenueId != dto.VenueId)
            return BadRequest(new { message = "Giữ chỗ không khớp cơ sở." });

        if (hold.Status != "ACTIVE")
            return Conflict(new { message = "Giữ chỗ đã hết hiệu lực hoặc đã được dùng." });

        if (hold.ExpiresAt <= DateTime.UtcNow)
        {
            hold.Status = "EXPIRED";
            await _dbContext.SaveChangesAsync();
            return Conflict(new { message = "Giữ chỗ đã hết hạn. Vui lòng chọn giờ lại." });
        }

        var holdItems = hold.BookingHoldItems.ToList();
        if (holdItems.Count == 0)
            return BadRequest(new { message = "Giữ chỗ không có khung giờ." });

        var normalizedItems = holdItems
            .Select(i => new NormalizedSlot(i.CourtId, i.StartTime, i.EndTime, i.FinalPrice))
            .ToList();

        var courtIds = normalizedItems.Select(x => x.CourtId).Distinct().ToList();
        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);

        var c1 = await TryConflictBookingsAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c1 != null) return c1;
        var c2 = await TryConflictBlocksAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c2 != null) return c2;
        var c3 = await TryConflictHoldOthersAsync(dto.VenueId, normalizedItems, courtIds, minStart, maxEnd, hold.Id);
        if (c3 != null) return c3;

        var courts = await _dbContext.Courts
            .AsNoTracking()
            .Where(c => courtIds.Contains(c.Id) && c.VenueId == dto.VenueId)
            .ToDictionaryAsync(c => c.Id);

        var total = normalizedItems.Sum(x => x.Price);

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            VenueId = dto.VenueId,
            Status = "PENDING",
            TotalAmount = total,
            DiscountAmount = 0,
            FinalAmount = total,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            GuestNote = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            CancellationPolicySnapshotJson = hold.CancellationPolicySnapshotJson,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var ni in normalizedItems)
        {
            booking.BookingItems.Add(new BookingItem
            {
                Id = Guid.NewGuid(),
                CourtId = ni.CourtId,
                StartTime = ni.Start,
                EndTime = ni.End,
                FinalPrice = ni.Price,
                Status = "PENDING"
            });
        }

        hold.Status = "CONSUMED";

        await using var trx = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            _dbContext.Bookings.Add(booking);
            await _dbContext.SaveChangesAsync();
            await trx.CommitAsync();
        }
        catch
        {
            await trx.RollbackAsync();
            throw;
        }

        var code = "SU" + booking.Id.ToString("N")[^6..].ToUpperInvariant();

        var response = new BookingResponseDto
        {
            BookingId = booking.Id,
            BookingCode = code,
            Status = booking.Status,
            TotalAmount = total,
            FinalAmount = total,
            Items = booking.BookingItems.Select(bi => new BookingItemResponseDto
            {
                Id = bi.Id,
                CourtId = bi.CourtId ?? Guid.Empty,
                CourtName = courts.GetValueOrDefault(bi.CourtId ?? Guid.Empty)?.Name,
                StartTime = bi.StartTime ?? default,
                EndTime = bi.EndTime ?? default,
                FinalPrice = bi.FinalPrice ?? 0,
                Status = bi.Status
            }).ToList()
        };

        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Giữ chỗ slot (TTL) trước khi tạo đơn.</summary>
    [HttpPost("hold")]
    public async Task<IActionResult> CreateHold([FromBody] CreateHoldRequestDto dto)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var holdMinutes = Math.Clamp(dto.HoldMinutes <= 0 ? 15 : dto.HoldMinutes, 1, 30);

        var venueOk = await _dbContext.Venues.AsNoTracking()
            .AnyAsync(v => v.Id == dto.VenueId && v.IsActive == true);
        if (!venueOk)
            return BadRequest(new { message = "Cơ sở không tồn tại hoặc chưa mở đặt sân." });

        var venuePolicy = await _dbContext.Venues.AsNoTracking()
            .Where(v => v.Id == dto.VenueId)
            .Select(v => new
            {
                v.CancelAllowed,
                v.CancelBeforeMinutes,
                v.RefundType,
                v.RefundPercent,
            })
            .FirstAsync();

        var norm = await TryNormalizeAndLoadCourtsAsync(dto.VenueId, dto.Items);
        if (norm.Fail != null)
            return norm.Fail;

        var normalizedItems = norm.Slots!;
        var courtIds = normalizedItems.Select(x => x.CourtId).Distinct().ToList();
        var minStart = normalizedItems.Min(x => x.Start);
        var maxEnd = normalizedItems.Max(x => x.End);

        var c1 = await TryConflictBookingsAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c1 != null)
            return c1;
        var c2 = await TryConflictBlocksAsync(normalizedItems, courtIds, minStart, maxEnd);
        if (c2 != null)
            return c2;
        var c3 = await TryConflictHoldOthersAsync(dto.VenueId, normalizedItems, courtIds, minStart, maxEnd, null);
        if (c3 != null)
            return c3;

        var holdId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddMinutes(holdMinutes);

        var policySnapshot = new CancellationPolicySnapshot
        {
            AllowCancel = venuePolicy.CancelAllowed,
            CancelBeforeMinutes = venuePolicy.CancelBeforeMinutes,
            RefundType = string.IsNullOrWhiteSpace(venuePolicy.RefundType) ? "NONE" : venuePolicy.RefundType!,
            RefundPercent = venuePolicy.RefundPercent,
        };

        var hold = new BookingHold
        {
            Id = holdId,
            UserId = userId,
            VenueId = dto.VenueId,
            Status = "ACTIVE",
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
            CancellationPolicySnapshotJson = JsonSerializer.Serialize(policySnapshot),
        };

        foreach (var ni in normalizedItems)
        {
            hold.BookingHoldItems.Add(new BookingHoldItem
            {
                Id = Guid.NewGuid(),
                HoldId = holdId,
                CourtId = ni.CourtId,
                StartTime = ni.Start,
                EndTime = ni.End,
                FinalPrice = ni.Price,
            });
        }

        _dbContext.BookingHolds.Add(hold);
        await _dbContext.SaveChangesAsync();

        return Ok(new CreateHoldResponseDto { HoldId = holdId, ExpiresAt = expiresAt });
    }

    [HttpGet("hold/{holdId:guid}")]
    public async Task<IActionResult> GetHold([FromRoute] Guid holdId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var hold = await _dbContext.BookingHolds
            .AsNoTracking()
            .Include(h => h.BookingHoldItems).ThenInclude(i => i.Court)
            .FirstOrDefaultAsync(h => h.Id == holdId);

        if (hold == null || hold.UserId != userId)
            return NotFound(new { message = "Không tìm thấy giữ chỗ." });

        return Ok(new
        {
            holdId = hold.Id,
            expiresAt = hold.ExpiresAt,
            venueId = hold.VenueId,
            status = hold.Status,
            items = hold.BookingHoldItems.Select(i => new
            {
                courtId = i.CourtId,
                courtName = i.Court != null ? i.Court.Name : null,
                startTime = i.StartTime,
                endTime = i.EndTime,
                price = i.FinalPrice,
            }),
        });
    }

    [HttpDelete("hold/{holdId:guid}")]
    public async Task<IActionResult> ReleaseHold([FromRoute] Guid holdId)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var hold = await _dbContext.BookingHolds.FirstOrDefaultAsync(h => h.Id == holdId);
        if (hold == null || hold.UserId != userId)
            return NotFound(new { message = "Không tìm thấy giữ chỗ." });

        if (hold.Status == "ACTIVE")
        {
            hold.Status = "RELEASED";
            await _dbContext.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>Tạo URL thanh toán VNPay (sandbox/prod theo cấu hình).</summary>
    [HttpPost("{id:guid}/vnpay/create-url")]
    public async Task<IActionResult> CreateVnpayPaymentUrl([FromRoute] Guid id)
    {
        var opt = _vnpayOptions.Value;
        if (!opt.Enabled || string.IsNullOrWhiteSpace(opt.TmnCode) || string.IsNullOrWhiteSpace(opt.HashSecret))
            return BadRequest(new { message = "VNPay chưa được cấu hình trên hệ thống." });

        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var booking = await _dbContext.Bookings
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);

        if (booking == null)
            return NotFound(new { message = "Không tìm thấy đơn đặt." });

        if (booking.Status != "PENDING")
            return BadRequest(new { message = "Chỉ thanh toán VNPay khi đơn đang chờ duyệt." });

        var amount = booking.FinalAmount ?? 0m;
        if (amount <= 0)
            return BadRequest(new { message = "Số tiền không hợp lệ." });

        var amountVnp = (long)(Math.Round(amount * 100m, 0, MidpointRounding.AwayFromZero));
        if (amountVnp <= 0)
            return BadRequest(new { message = "Số tiền không hợp lệ." });

        var backendBase = _configuration["App:BackendPublicUrl"]?.TrimEnd('/') ?? $"{Request.Scheme}://{Request.Host}";
        var returnUrl = $"{backendBase}/api/payments/vnpay/return";
        var ipnUrl = $"{backendBase}/api/payments/vnpay/ipn";

        var existingPending = await _dbContext.Payments
            .Where(p => p.BookingId == id && p.Method == "VNPAY"
                                           && p.Status != null && p.Status == "PENDING")
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        Payment payRow;
        if (existingPending != null)
        {
            payRow = existingPending;
            if (payRow.Amount != amount)
            {
                payRow.Amount = amount;
                await _dbContext.SaveChangesAsync();
            }
        }
        else
        {
            payRow = new Payment
            {
                Id = Guid.NewGuid(),
                BookingId = id,
                Method = "VNPAY",
                Status = "PENDING",
                Amount = amount,
                CreatedAt = DateTime.UtcNow,
            };
            _dbContext.Payments.Add(payRow);
            await _dbContext.SaveChangesAsync();
        }

        var bookingCode = "SU" + id.ToString("N")[^6..].ToUpperInvariant();
        var createDate = DateTime.UtcNow.AddHours(7).ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ip))
            ip = "127.0.0.1";
        if (ip.StartsWith("::ffff:", StringComparison.Ordinal))
            ip = ip["::ffff:".Length..];

        var vnp = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = opt.TmnCode.Trim(),
            ["vnp_Amount"] = amountVnp.ToString(CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_TxnRef"] = payRow.Id.ToString("N"),
            ["vnp_OrderInfo"] = $"Thanh toan dat san {bookingCode}".Length > 240
                ? $"Thanh toan {bookingCode}"
                : $"Thanh toan dat san {bookingCode}",
            ["vnp_OrderType"] = "other",
            ["vnp_Locale"] = "vn",
            ["vnp_ReturnUrl"] = returnUrl,
            ["vnp_IpnUrl"] = ipnUrl,
            ["vnp_CreateDate"] = createDate,
            ["vnp_IpAddr"] = ip,
        };

        var payUrl = VnpayQueryBuilder.BuildPaymentUrl(opt.PaymentUrl, vnp, opt.HashSecret);
        return Ok(new { paymentId = payRow.Id, payUrl });
    }
}

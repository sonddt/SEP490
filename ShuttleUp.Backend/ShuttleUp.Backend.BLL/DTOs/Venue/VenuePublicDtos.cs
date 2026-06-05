using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Venue;

public class VenuePublicDetailsDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public decimal? WeeklyDiscountPercent { get; set; }
    public decimal? MonthlyDiscountPercent { get; set; }
    public string? Description { get; set; }
    public List<string>? Includes { get; set; }
    public List<string>? Rules { get; set; }
    public List<string>? Amenities { get; set; }
    public int? SlotDuration { get; set; }
    public bool? CancelAllowed { get; set; }
    public string? ThumbnailUrl { get; set; }
    public Guid? OwnerUserId { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerEmail { get; set; }
    public string? OwnerAvatarUrl { get; set; }
    public string? OwnerPhone { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public double Rating { get; set; }
    public int ReviewCount { get; set; }
    public List<string> ImageUrls { get; set; } = new();
}

public class VenueMapItemDto
{
    public Guid Id { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public string? Name { get; set; }
    public decimal? MinPrice { get; set; }
}

public class VenueCardDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public DateTime? CreatedAt { get; set; }
    public Guid? OwnerUserId { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerAvatarUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public List<string>? Amenities { get; set; }
    public double Rating { get; set; }
    public int ReviewCount { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
}

public class VenuePublicCourtDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? GroupName { get; set; }
    public List<VenuePublicCourtPriceDto> Prices { get; set; } = new();
    public List<VenuePublicCourtOpenHourDto> OpenHours { get; set; } = new();
}

public class VenuePublicCourtPriceDto
{
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal Price { get; set; }
    public bool IsWeekend { get; set; }
}

public class VenuePublicCourtOpenHourDto
{
    public int DayOfWeek { get; set; }
    public bool Enabled { get; set; }
    public TimeOnly? OpenTime { get; set; }
    public TimeOnly? CloseTime { get; set; }
}

public class VenueCheckoutSettingsPublicDto
{
    public Guid VenueId { get; set; }
    public string? VenueName { get; set; }
    public string? BankName { get; set; }
    public string? BankBin { get; set; }
    public string? AccountNumber { get; set; }
    public string? AccountHolder { get; set; }
    public string? TransferNoteTemplate { get; set; }
    public string? PaymentNote { get; set; }
    public string? VenueRules { get; set; }
    public string? VietQrImageUrl { get; set; }
    public VenueCancellationPolicyPublicDto Cancellation { get; set; } = new();
}

public class VenueCancellationPolicyPublicDto
{
    public bool? AllowCancel { get; set; }
    public int? CancelBeforeMinutes { get; set; }
    public string? RefundType { get; set; }
    public decimal? RefundPercent { get; set; }
}

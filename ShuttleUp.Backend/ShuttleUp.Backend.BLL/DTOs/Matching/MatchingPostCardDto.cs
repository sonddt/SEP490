namespace ShuttleUp.BLL.DTOs.Matching;

public class MatchingHostDto
{
    public Guid? Id { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? SkillLevel { get; set; }
    public string? Gender { get; set; }
}

public class MatchingPostCardDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public DateOnly? PlayDate { get; set; }
    public string? PlayStartTime { get; set; }
    public string? PlayEndTime { get; set; }
    public string? VenueName { get; set; }
    public string? VenueAddress { get; set; }
    public string? VenueImageUrl { get; set; }
    public string? CourtName { get; set; }
    public decimal? PricePerSlot { get; set; }
    /// <summary>Chi phí / người trước giảm giá đơn (khi chia đều).</summary>
    public decimal? OriginalPricePerSlot { get; set; }
    public decimal? TotalCourtPrice { get; set; }
    public decimal? OriginalTotalCourtPrice { get; set; }
    public bool HasDiscount { get; set; }
    public int? RequiredPlayers { get; set; }
    public string? SkillLevel { get; set; }
    public string? GenderPref { get; set; }
    public string? ExpenseSharing { get; set; }
    public string? PlayPurpose { get; set; }
    public string? Status { get; set; }
    public int MembersCount { get; set; }
    public int PendingRequests { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsHost { get; set; }
    public bool IsMember { get; set; }
    public bool IsPending { get; set; }
    public bool CanRequestJoin { get; set; }
    public MatchingHostDto? Host { get; set; }
}

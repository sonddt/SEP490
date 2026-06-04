namespace ShuttleUp.BLL.DTOs.Matching;

public class MatchingMemberDto
{
    public Guid MemberId { get; set; }
    public Guid? UserId { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? SkillLevel { get; set; }
    public string? Gender { get; set; }
    public DateTime? JoinedAt { get; set; }
}

public class MatchingBookingItemDto
{
    public Guid BookingItemId { get; set; }
    public string? CourtName { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal? Price { get; set; }
    /// <summary>Giá ca trước khi phân bổ giảm giá đơn đặt sân.</summary>
    public decimal? OriginalPrice { get; set; }
}

public class MatchingJoinRequestDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? SkillLevel { get; set; }
    public string? Gender { get; set; }
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class MatchingPostDetailDto : MatchingPostCardDto
{
    public string? Notes { get; set; }
    public IEnumerable<MatchingMemberDto>? Members { get; set; }
    public IEnumerable<MatchingBookingItemDto>? BookingItems { get; set; }
    public Guid? MyMemberId { get; set; }
    public Guid? MyJoinRequestId { get; set; }
    public new IEnumerable<MatchingJoinRequestDto>? PendingRequests { get; set; }
}

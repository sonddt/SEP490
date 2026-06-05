namespace ShuttleUp.BLL.DTOs.Matching;

public class CreateMatchingPostDto
{
    public Guid BookingId { get; set; }
    public List<Guid>? BookingItemIds { get; set; }
    public string? Title { get; set; }
    public int RequiredPlayers { get; set; }
    public string? SkillLevel { get; set; }
    public string? GenderPref { get; set; }
    public string? ExpenseSharing { get; set; }
    public string? PlayPurpose { get; set; }
    public string? Notes { get; set; }
}

public class UpdateMatchingPostDto
{
    public string? Title { get; set; }
    public int? RequiredPlayers { get; set; }
    public string? SkillLevel { get; set; }
    public string? GenderPref { get; set; }
    public string? ExpenseSharing { get; set; }
    public string? PlayPurpose { get; set; }
    public string? Notes { get; set; }
}

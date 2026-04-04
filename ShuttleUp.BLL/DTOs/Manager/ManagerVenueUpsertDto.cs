namespace ShuttleUp.BLL.DTOs.Manager;

public class ManagerVenueUpsertDto
{
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public decimal? WeeklyDiscountPercent { get; set; }
    public decimal? MonthlyDiscountPercent { get; set; }
}


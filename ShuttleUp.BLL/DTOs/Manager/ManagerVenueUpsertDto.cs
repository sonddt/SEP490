namespace ShuttleUp.BLL.DTOs.Manager;

public class ManagerVenueUpsertDto
{
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
}


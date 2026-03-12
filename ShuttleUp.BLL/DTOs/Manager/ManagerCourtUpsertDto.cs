namespace ShuttleUp.BLL.DTOs.Manager;

public class ManagerCourtUpsertDto
{
    public string Name { get; set; } = null!;
    public string? SportType { get; set; }
    public bool? IsActive { get; set; }
}


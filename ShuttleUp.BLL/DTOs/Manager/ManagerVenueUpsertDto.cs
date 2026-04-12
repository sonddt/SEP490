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
    public int SlotDuration { get; set; } = 60;

    /// <summary>Mô tả tổng quan về cơ sở — hiển thị tab Tổng quan.</summary>
    public string? Description { get; set; }

    /// <summary>Những gì khách được sử dụng khi thuê sân — hiển thị tab Bao gồm.</summary>
    public List<string>? Includes { get; set; }

    /// <summary>Các quy định tại cơ sở — hiển thị tab Quy định.</summary>
    public List<string>? Rules { get; set; }

    /// <summary>Key tiện ích có tại cơ sở (parking, wifi, ...) — hiển thị tab Tiện ích.</summary>
    public List<string>? Amenities { get; set; }
}

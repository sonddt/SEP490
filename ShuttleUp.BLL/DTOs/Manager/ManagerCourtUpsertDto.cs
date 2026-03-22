using System.ComponentModel.DataAnnotations;

namespace ShuttleUp.BLL.DTOs.Manager;

public class ManagerCourtPriceSlotDto
{
    /// <summary>
    /// Thời gian bắt đầu, định dạng "HH:mm", ví dụ "14:00".
    /// </summary>
    [Required]
    public string StartTime { get; set; } = null!;

    /// <summary>
    /// Thời gian kết thúc, định dạng "HH:mm", ví dụ "15:00".
    /// </summary>
    [Required]
    public string EndTime { get; set; } = null!;

    /// <summary>
    /// Giá sân áp dụng cho khung giờ này (VND).
    /// </summary>
    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    /// <summary>
    /// Khung giờ này áp dụng cho cuối tuần hay ngày thường.
    /// </summary>
    public bool IsWeekend { get; set; }
}

public class ManagerCourtOpenHourDto
{
    /// <summary>
    /// Thứ trong tuần, mapping theo FE (Thứ 2 -> 0 ... Chủ nhật -> 6).
    /// </summary>
    [Required]
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Nếu false: bỏ qua OpenTime/CloseTime.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Định dạng "HH:mm".
    /// </summary>
    public string? OpenTime { get; set; }

    /// <summary>
    /// Định dạng "HH:mm".
    /// </summary>
    public string? CloseTime { get; set; }
}

public class ManagerCourtUpsertDto
{
    [Required]
    public string Name { get; set; } = null!;

    public string Status { get; set; } = "ACTIVE";

    public string? Surface { get; set; }

    public int? MaxGuests { get; set; }

    public string? Description { get; set; }

    /// <summary>
    /// Trạng thái chung của court (mặc định là hoạt động).
    /// </summary>
    public bool? IsActive { get; set; }

    /// <summary>
    /// Danh sách cấu hình giá theo khung giờ trong ngày.
    /// </summary>
    public List<ManagerCourtPriceSlotDto> PriceSlots { get; set; } = new();

    /// <summary>
    /// Lịch mở cửa theo ngày trong tuần.
    /// </summary>
    public List<ManagerCourtOpenHourDto> OpenHours { get; set; } = new();
}


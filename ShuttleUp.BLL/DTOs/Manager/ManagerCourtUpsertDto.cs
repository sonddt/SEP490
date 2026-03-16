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

public class ManagerCourtUpsertDto
{
    [Required]
    public string Name { get; set; } = null!;

    public string? SportType { get; set; }

    /// <summary>
    /// Trạng thái chung của court (mặc định là hoạt động).
    /// </summary>
    public bool? IsActive { get; set; }

    /// <summary>
    /// Danh sách cấu hình giá theo khung giờ trong ngày.
    /// </summary>
    public List<ManagerCourtPriceSlotDto> PriceSlots { get; set; } = new();
}


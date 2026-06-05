using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ManagerProfile
{
    public Guid UserId { get; set; }

    public string? TaxCode { get; set; }

    // CCCD hai mặt (lưu dạng file id để hiển thị ảnh đã upload)
    public Guid? CccdFrontFileId { get; set; }
    public Guid? CccdBackFileId { get; set; }

    // Giấy phép kinh doanh: tối đa 3 file
    public Guid? BusinessLicenseFileId1 { get; set; }
    public Guid? BusinessLicenseFileId2 { get; set; }
    public Guid? BusinessLicenseFileId3 { get; set; }

    public string? Address { get; set; }

    public string? Status { get; set; }

    public Guid? AdminUserId { get; set; }

    public DateTime? DecisionAt { get; set; }

    public string? DecisionNote { get; set; }

    public virtual User? AdminUser { get; set; }

    public virtual User User { get; set; } = null!;
}

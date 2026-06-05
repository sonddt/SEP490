using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ManagerProfileRequest
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    // DANG_KY | CAP_NHAT
    public string RequestType { get; set; } = null!;

    // PENDING | APPROVED | REJECTED
    public string Status { get; set; } = null!;

    public DateTime? RequestedAt { get; set; }

    public string? TaxCode { get; set; }

    public string? Address { get; set; }

    // CCCD hai mặt
    public Guid? CccdFrontFileId { get; set; }
    public Guid? CccdBackFileId { get; set; }

    // Giấy phép kinh doanh: tối đa 3 file
    public Guid? BusinessLicenseFileId1 { get; set; }
    public Guid? BusinessLicenseFileId2 { get; set; }
    public Guid? BusinessLicenseFileId3 { get; set; }

    public Guid? AdminUserId { get; set; }
    public DateTime? DecisionAt { get; set; }
    public string? DecisionNote { get; set; }

    public virtual User? AdminUser { get; set; }
    public virtual User User { get; set; } = null!;
}


using System;
using System.Collections.Generic;

namespace ShuttleUp.DAL.Models;

public partial class ManagerProfile
{
    public Guid UserId { get; set; }

    public string? IdCardNo { get; set; }

    public string? TaxCode { get; set; }

    public string? BusinessLicenseNo { get; set; }

    public string? Address { get; set; }

    public string? Status { get; set; }

    public Guid? AdminUserId { get; set; }

    public DateTime? DecisionAt { get; set; }

    public string? DecisionNote { get; set; }

    public virtual User? AdminUser { get; set; }

    public virtual User User { get; set; } = null!;
}

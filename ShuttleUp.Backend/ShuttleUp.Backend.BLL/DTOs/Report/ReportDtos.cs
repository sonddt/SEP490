using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Report;

public class CreateReportRequestDto
{
    public string TargetType { get; set; } = null!;
    public Guid TargetId { get; set; }
    public string Reason { get; set; } = null!;
    public string? Description { get; set; }
    public List<Guid>? FileIds { get; set; }
}

public class MyReportItemDto
{
    public Guid Id { get; set; }
    public string? TargetType { get; set; }
    public Guid? TargetId { get; set; }
    public string? Reason { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string? AdminAction { get; set; }
    public string? AdminNote { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? DecisionAt { get; set; }
    public DateTime? RefundDeadlineAt { get; set; }
    public List<string> FileUrls { get; set; } = new();
}

public class MyReportsPagedResultDto
{
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<MyReportItemDto> Items { get; set; } = new();
}

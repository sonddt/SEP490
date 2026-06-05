using System;
using System.Collections.Generic;

namespace ShuttleUp.BLL.DTOs.Notification;

public class NotificationItemDto
{
    public Guid Id { get; set; }
    public string? Type { get; set; }
    public string? Title { get; set; }
    public string? Body { get; set; }
    public string? MetadataJson { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationsPagedResultDto
{
    public List<NotificationItemDto> Items { get; set; } = new();
    public bool HasMore { get; set; }
    public string? NextBefore { get; set; }
}

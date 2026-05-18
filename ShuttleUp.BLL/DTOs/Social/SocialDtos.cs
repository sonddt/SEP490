using System;

namespace ShuttleUp.BLL.DTOs.Social;

public class PrivacyDto
{
    public bool AllowFindByEmail { get; set; }
    public bool AllowFindByPhone { get; set; }
}

public class UserSearchDto
{
    public Guid Id { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
}

public class FriendRequestDto
{
    public Guid Id { get; set; }
    public Guid FromUserId { get; set; }
    public Guid? ToUserId { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class FriendDto
{
    public Guid Id { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
}

public class RelationshipStateDto
{
    public string State { get; set; } = "NONE";
    public Guid? RequestId { get; set; }
}

public class SendRequestDto
{
    public Guid ToUserId { get; set; }
}

public class BlockDto
{
    public Guid BlockedUserId { get; set; }
}

public class AcceptRequestResponseDto
{
    public Guid Id { get; set; }
    public bool MutualAutoAccept { get; set; }
    public bool SimultaneousMutual { get; set; }
    public string Message { get; set; } = string.Empty;
}

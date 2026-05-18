namespace ShuttleUp.BLL.DTOs.Matching;

public class MatchingPagedResultDto<T>
{
    public int Total { get; set; }
    public int TotalAll { get; set; } // Special for comments
    public int Page { get; set; }
    public int PageSize { get; set; }
    public string? Sort { get; set; }
    public IEnumerable<T> Items { get; set; } = new List<T>();
}

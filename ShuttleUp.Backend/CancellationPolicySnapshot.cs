using System.Text.Json.Serialization;

namespace ShuttleUp.Backend;

public class CancellationPolicySnapshot
{
    [JsonPropertyName("allowCancel")]
    public bool AllowCancel { get; set; } = true;

    [JsonPropertyName("cancelBeforeMinutes")]
    public int CancelBeforeMinutes { get; set; } = 120;

    /// <summary>NONE | PERCENT | FULL</summary>
    [JsonPropertyName("refundType")]
    public string RefundType { get; set; } = "NONE";

    [JsonPropertyName("refundPercent")]
    public decimal? RefundPercent { get; set; }
}

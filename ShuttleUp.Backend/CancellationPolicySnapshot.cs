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

    /// <summary>
    /// Hoàn tiền theo snapshot (FULL / PERCENT / NONE). Dùng chung cho preview, hủy đơn và đối soát.
    /// </summary>
    public decimal ComputeRefundAmount(decimal baseAmount)
    {
        if (baseAmount <= 0) return 0;
        var rt = string.IsNullOrWhiteSpace(RefundType) ? "NONE" : RefundType.Trim().ToUpperInvariant();
        return rt switch
        {
            "FULL" => baseAmount,
            "PERCENT" when RefundPercent.HasValue => Math.Round(baseAmount * RefundPercent.Value / 100m, 0),
            _ => 0,
        };
    }
}

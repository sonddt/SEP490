using System.Net.Http.Json;
using ShuttleUp.BLL.Interfaces;

namespace ShuttleUp.BLL.Services;

public class BankLookupService : IBankLookupService
{
    private readonly IHttpClientFactory _httpFactory;

    public BankLookupService(IHttpClientFactory httpFactory)
    {
        _httpFactory = httpFactory;
    }

    public async Task<object> LookupBankAccountAsync(string bin, string accountNumber, string? clientId, string? apiKey, string? lookupUrl)
    {
        if (string.IsNullOrWhiteSpace(bin) || string.IsNullOrWhiteSpace(accountNumber))
            throw new InvalidOperationException("Thiếu mã BIN hoặc số tài khoản.");

        var url = string.IsNullOrWhiteSpace(lookupUrl) ? "https://api.vietqr.io/v2/lookup" : lookupUrl.Trim();

        var client = _httpFactory.CreateClient("VietQR");
        client.Timeout = TimeSpan.FromSeconds(10);
        client.DefaultRequestHeaders.Clear();
        if (!string.IsNullOrWhiteSpace(clientId)) client.DefaultRequestHeaders.Add("x-client-id", clientId.Trim());
        if (!string.IsNullOrWhiteSpace(apiKey)) client.DefaultRequestHeaders.Add("x-api-key", apiKey.Trim());

        var resp = await client.PostAsJsonAsync(url, new { bin = bin.Trim(), accountNumber = accountNumber.Trim() });
        var body = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"VietQR lookup thất bại (HTTP {(int)resp.StatusCode}): {body}");

        return new { success = true, raw = body };
    }
}

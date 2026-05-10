namespace ShuttleUp.BLL.Interfaces;

public interface IBankLookupService
{
    Task<object> LookupBankAccountAsync(string bin, string accountNumber, string? clientId, string? apiKey, string? lookupUrl);
}

using ShuttleUp.DAL.Models;

namespace ShuttleUp.BLL.Helpers;

public static class PriceDistributionHelper
{
    public static Dictionary<Guid, decimal> BuildActualItemPriceMap(Booking booking)
    {
        var itemPrices = (booking.BookingItems ?? new List<BookingItem>())
            .Where(i => i.Id != Guid.Empty)
            .ToDictionary(i => i.Id, i => i.FinalPrice ?? 0m);

        if (itemPrices.Count == 0)
            return itemPrices;

        var totalAmount = booking.TotalAmount ?? 0m;
        var finalAmount = booking.FinalAmount ?? totalAmount;
        if (totalAmount <= 0m || finalAmount <= 0m)
            return itemPrices;

        var ratio = finalAmount / totalAmount;
        if (ratio >= 0.999999m && ratio <= 1.000001m)
            return itemPrices;

        var orderedItems = booking.BookingItems!
            .OrderBy(i => i.StartTime)
            .ThenBy(i => i.Id)
            .ToList();

        var targetTotal = finalAmount;
        decimal distributed = 0m;
        var actualMap = new Dictionary<Guid, decimal>(orderedItems.Count);

        for (var idx = 0; idx < orderedItems.Count; idx++)
        {
            var item = orderedItems[idx];
            var original = item.FinalPrice ?? 0m;
            decimal actual;

            if (idx == orderedItems.Count - 1)
            {
                actual = targetTotal - distributed;
            }
            else
            {
                actual = Math.Round(original * ratio, 0, MidpointRounding.AwayFromZero);
                distributed += actual;
            }

            actualMap[item.Id] = Math.Max(actual, 0m);
        }

        return actualMap;
    }
}

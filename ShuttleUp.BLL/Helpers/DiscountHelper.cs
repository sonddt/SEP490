using ShuttleUp.DAL.Models;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShuttleUp.BLL.Helpers;

public static class DiscountHelper
{
    /// <summary>
    /// Tính chuỗi ngày liên tục dài nhất từ danh sách ngày có booking.
    /// "Liên tục" = mỗi ngày liền kề nhau, không ngắt quãng.
    /// </summary>
    public static int ComputeLongestConsecutiveStreak(IReadOnlyList<DateTime> bookedDates)
    {
        if (bookedDates == null || bookedDates.Count == 0) return 0;

        var uniqueDates = bookedDates
            .Select(d => d.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        if (uniqueDates.Count == 0) return 0;
        if (uniqueDates.Count == 1) return 1;

        int longestStreak = 1;
        int currentStreak = 1;

        for (int i = 1; i < uniqueDates.Count; i++)
        {
            if ((uniqueDates[i] - uniqueDates[i - 1]).Days == 1)
            {
                currentStreak++;
                if (currentStreak > longestStreak)
                    longestStreak = currentStreak;
            }
            else
            {
                currentStreak = 1;
            }
        }

        return longestStreak;
    }

    /// <summary>
    /// Tính toán các khoản giảm giá (tự động theo chuỗi ngày & theo coupon).
    /// </summary>
    public static (decimal DiscountAmount, decimal FinalAmount, Guid? CouponId, VenueCoupon? CouponToUpdate, string? ErrorMsg, decimal LongTermDiscountAmount, decimal CouponDiscountAmount) CalculateDiscount(
        Venue venue,
        decimal totalAmount,
        IReadOnlyList<DateTime> bookedDates,
        string? couponCode,
        VenueCoupon? coupon,
        bool hasUserUsedCoupon)
    {
        if (venue == null) return (0, totalAmount, null, null, "Venue not found", 0, 0);

        // Tính chuỗi ngày liên tục dài nhất (consecutive streak)
        var consecutiveStreak = ComputeLongestConsecutiveStreak(bookedDates);

        decimal autoDiscountAmount = 0;
        
        if (consecutiveStreak >= 30 && venue.MonthlyDiscountPercent > 0)
        {
            autoDiscountAmount = totalAmount * (venue.MonthlyDiscountPercent.Value / 100m);
        }
        else if (consecutiveStreak >= 7 && venue.WeeklyDiscountPercent > 0)
        {
            autoDiscountAmount = totalAmount * (venue.WeeklyDiscountPercent.Value / 100m);
        }

        decimal discountAmount = autoDiscountAmount;
        decimal finalAmount = totalAmount - discountAmount;
        Guid? couponId = null;
        VenueCoupon? couponToUpdate = null;

        if (!string.IsNullOrWhiteSpace(couponCode) && coupon != null)
        {
            var now = DateTime.UtcNow;
            if (now < coupon.StartDate || now > coupon.EndDate)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá không trong thời gian sử dụng.", autoDiscountAmount, 0);

            if (coupon.MinBookingValue > 0 && finalAmount < coupon.MinBookingValue)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, $"Mã giảm giá yêu cầu giá trị đơn tối thiểu {coupon.MinBookingValue:N0} VNĐ (sau khi đã trừ tự động).", autoDiscountAmount, 0);

            if (coupon.UsageLimit.HasValue && (coupon.UsedCount ?? 0) >= coupon.UsageLimit.Value)
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá đã hết lượt sử dụng.", autoDiscountAmount, 0);

            if (coupon.OneUsePerUser && hasUserUsedCoupon)
            {
                return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã này chỉ dùng được một lần cho mỗi tài khoản. Bạn đã sử dụng trước đó.", autoDiscountAmount, 0);
            }

            decimal couponDiscount = 0;
            if (coupon.DiscountType == "PERCENT")
            {
                couponDiscount = finalAmount * (coupon.DiscountValue / 100m);
                if (coupon.MaxDiscountAmount.HasValue && couponDiscount > coupon.MaxDiscountAmount.Value)
                {
                    couponDiscount = coupon.MaxDiscountAmount.Value;
                }
            }
            else
            {
                couponDiscount = coupon.DiscountValue;
            }

            if (couponDiscount > finalAmount) couponDiscount = finalAmount;

            discountAmount += couponDiscount;
            finalAmount -= couponDiscount;
            couponId = coupon.Id;
            couponToUpdate = coupon;
        }
        else if (!string.IsNullOrWhiteSpace(couponCode) && coupon == null)
        {
             return (autoDiscountAmount, totalAmount - autoDiscountAmount, null, null, "Mã giảm giá không hợp lệ hoặc đã bị khóa.", autoDiscountAmount, 0);
        }

        var couponDiscountAmount = discountAmount - autoDiscountAmount;
        return (discountAmount, finalAmount, couponId, couponToUpdate, null, autoDiscountAmount, couponDiscountAmount);
    }
}

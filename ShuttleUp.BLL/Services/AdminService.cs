using ShuttleUp.BLL.Helpers;
using ShuttleUp.BLL.Interfaces;
using ShuttleUp.DAL.Models;
using ShuttleUp.DAL.Repositories.Interfaces;
using ShuttleUp.BLL.DTOs.Booking;
using DalFile = ShuttleUp.DAL.Models.File;

namespace ShuttleUp.BLL.Services;

public class AdminService : IAdminService
{
    private readonly IUserRepository _userRepo;
    private readonly IVenueRepository _venueRepo;
    private readonly IBookingRepository _bookingRepo;
    private readonly IRefundRepository _refundRepo;
    private readonly IManagerProfileRequestRepository _requestRepo;
    private readonly IManagerProfileRepository _profileRepo;
    private readonly IRoleRepository _roleRepo;
    private readonly IFileRepository _fileRepo;
    private readonly IViolationReportRepository _reportRepo;

    private static readonly string[] PaidStatuses = ["CONFIRMED", "COMPLETED"];

    public AdminService(IUserRepository userRepo, IVenueRepository venueRepo, IBookingRepository bookingRepo,
        IRefundRepository refundRepo, IManagerProfileRequestRepository requestRepo, IManagerProfileRepository profileRepo,
        IRoleRepository roleRepo, IFileRepository fileRepo, IViolationReportRepository reportRepo)
    {
        _userRepo = userRepo; _venueRepo = venueRepo; _bookingRepo = bookingRepo;
        _refundRepo = refundRepo; _requestRepo = requestRepo; _profileRepo = profileRepo;
        _roleRepo = roleRepo; _fileRepo = fileRepo; _reportRepo = reportRepo;
    }

    public async Task<object> GetDashboardStatsAsync()
    {
        var totalUsers = await _userRepo.CountAllAsync();
        var pendingReports = await _reportRepo.CountPendingReportsAsync();
        var pendingComplaints = await _reportRepo.CountPendingComplaintsAsync();

        var recentUsers = (await _userRepo.GetRecentUsersAsync(5)).Select(u => new
        {
            u.Id, u.FullName, u.Email, u.IsActive, u.CreatedAt, Roles = u.Roles.Select(r => r.Name).ToList()
        }).ToList();

        var pendingVenues = (await _requestRepo.GetRecentPendingAsync(5)).Select(r => new
        {
            Id = r.Id, Name = string.IsNullOrWhiteSpace(r.TaxCode) ? "Cá nhân" : $"MST: {r.TaxCode}",
            Address = r.Address, CreatedAt = r.RequestedAt ?? r.User?.CreatedAt,
            OwnerName = r.User?.FullName, OwnerEmail = r.User?.Email
        }).ToList();

        return new { totalUsers, pendingReports, pendingComplaints, recentUsers, pendingVenues };
    }

    public async Task<object> GetAccountsPagedAsync(string? search, string? role, string? status, int page, int pageSize)
    {
        if (page <= 0) page = 1; if (pageSize <= 0 || pageSize > 100) pageSize = 20;
        var totalItems = await _userRepo.CountUsersAsync(search, role, status);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var users = await _userRepo.GetUsersPagedAsync(search, role, status, (page - 1) * pageSize, pageSize);
        var items = users.Select(u => new
        {
            u.Id, u.FullName, u.Email, u.PhoneNumber, u.Gender, u.DateOfBirth, u.IsActive,
            u.BlockedAt, u.BlockedReason, u.BanType, u.SoftBanExpiresAt, u.CreatedAt,
            Roles = u.Roles.Select(r => r.Name).ToList()
        }).ToList();
        return new { totalItems, totalPages, page, pageSize, items };
    }

    public async Task<object?> GetAccountDetailAsync(Guid userId)
    {
        var user = await _userRepo.GetWithRolesAsync(userId);
        if (user == null) return null;
        return new
        {
            user.Id, user.FullName, user.Email, user.PhoneNumber, user.Gender, user.DateOfBirth,
            user.IsActive, user.BlockedAt, user.BlockedReason, user.BanType, user.SoftBanExpiresAt,
            user.CreatedAt, user.UpdatedAt, Roles = user.Roles.Select(r => r.Name).ToList()
        };
    }

    public async Task UnblockAccountAsync(Guid userId, bool restoreVenues)
    {
        var user = await _userRepo.GetByIdAsync(userId) ?? throw new KeyNotFoundException("Người dùng không tồn tại.");
        if (user.IsActive == true && user.BanType != "SOFT") throw new InvalidOperationException("Tài khoản đang hoạt động bình thường.");
        user.IsActive = true; user.BanType = null; user.SoftBanExpiresAt = null; user.BlockedAt = null; user.BlockedBy = null; user.BlockedReason = null;
        await _userRepo.UpdateAsync(user);

        if (restoreVenues)
        {
            var venues = (await _venueRepo.GetByOwnerAsync(userId)).ToList();
            foreach (var v in venues) { v.IsActive = true; await _venueRepo.UpdateAsync(v); }
        }
    }

    public async Task<object> GetManagerRequestsPagedAsync(string? search, string? status, int page, int pageSize)
    {
        if (page <= 0) page = 1; if (pageSize <= 0 || pageSize > 100) pageSize = 20;
        var totalItems = await _requestRepo.CountRequestsAsync(search, status);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var rawItems = await _requestRepo.GetRequestsPagedAsync(search, status, (page - 1) * pageSize, pageSize);

        var fileIds = rawItems.SelectMany(r => new Guid?[] { r.CccdFrontFileId, r.CccdBackFileId, r.BusinessLicenseFileId1, r.BusinessLicenseFileId2, r.BusinessLicenseFileId3 })
            .Where(id => id != null).Select(id => id!.Value).Distinct().ToList();
        var files = await _fileRepo.GetByIdsAsync(fileIds);
        var fileDict = files.ToDictionary(f => f.Id, f => f);
        string? UrlOf(Guid? fId) => fId != null && fileDict.TryGetValue(fId.Value, out var f) ? f.FileUrl : null;
        string? MimeOf(Guid? fId) => fId != null && fileDict.TryGetValue(fId.Value, out var f) ? f.MimeType : null;

        var items = rawItems.Select(r => new
        {
            r.Id, r.Status, r.RequestType, r.TaxCode, r.Address,
            cccdFrontUrl = UrlOf(r.CccdFrontFileId), cccdBackUrl = UrlOf(r.CccdBackFileId),
            businessLicenseFiles = new[] { new { id = r.BusinessLicenseFileId1, url = UrlOf(r.BusinessLicenseFileId1), mimeType = MimeOf(r.BusinessLicenseFileId1) }, new { id = r.BusinessLicenseFileId2, url = UrlOf(r.BusinessLicenseFileId2), mimeType = MimeOf(r.BusinessLicenseFileId2) }, new { id = r.BusinessLicenseFileId3, url = UrlOf(r.BusinessLicenseFileId3), mimeType = MimeOf(r.BusinessLicenseFileId3) } }
                .Where(x => x.url != null).Select(x => new { url = x.url, mimeType = x.mimeType, id = x.id }).ToList(),
            OwnerName = r.User?.FullName, OwnerEmail = r.User?.Email, RequestedAt = r.RequestedAt,
            r.DecisionAt, r.DecisionNote, AdminName = r.AdminUser?.FullName
        }).ToList();

        return new { totalItems, totalPages, page, pageSize, items };
    }

    public async Task<AdminApproveResult> ApproveManagerRequestAsync(Guid requestId, Guid adminId, string? note)
    {
        var request = await _requestRepo.GetWithUserAndRolesAsync(requestId) ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ yêu cầu này.");
        if (request.Status != "PENDING") throw new InvalidOperationException($"Hồ sơ đã được xử lý ({request.Status}).");

        var reqType = request.RequestType?.Trim().ToUpperInvariant();
        if (reqType == "DANG_KY")
        {
            var hasCccd = request.CccdFrontFileId != null && request.CccdBackFileId != null;
            var hasLicense = request.BusinessLicenseFileId1 != null || request.BusinessLicenseFileId2 != null || request.BusinessLicenseFileId3 != null;
            if (!hasCccd || !hasLicense || string.IsNullOrWhiteSpace(request.TaxCode) || string.IsNullOrWhiteSpace(request.Address))
                throw new InvalidOperationException("Hồ sơ chưa đủ giấy tờ để duyệt.");
        }

        var now = DateTime.UtcNow;
        request.Status = "APPROVED"; request.AdminUserId = adminId; request.DecisionAt = now; request.DecisionNote = note;

        var snapshot = await _profileRepo.GetByUserIdAsync(request.UserId);
        if (snapshot == null) { snapshot = new ManagerProfile { UserId = request.UserId }; await _profileRepo.AddAsync(snapshot); }
        if (!string.IsNullOrWhiteSpace(request.TaxCode)) snapshot.TaxCode = request.TaxCode;
        if (!string.IsNullOrWhiteSpace(request.Address)) snapshot.Address = request.Address;
        if (request.CccdFrontFileId != null) snapshot.CccdFrontFileId = request.CccdFrontFileId;
        if (request.CccdBackFileId != null) snapshot.CccdBackFileId = request.CccdBackFileId;
        if (request.BusinessLicenseFileId1 != null || request.BusinessLicenseFileId2 != null || request.BusinessLicenseFileId3 != null)
        { snapshot.BusinessLicenseFileId1 = request.BusinessLicenseFileId1; snapshot.BusinessLicenseFileId2 = request.BusinessLicenseFileId2; snapshot.BusinessLicenseFileId3 = request.BusinessLicenseFileId3; }
        snapshot.Status = "APPROVED"; snapshot.AdminUserId = adminId; snapshot.DecisionAt = now; snapshot.DecisionNote = note;
        await _profileRepo.UpdateAsync(snapshot);

        var managerRole = await _roleRepo.GetByNameAsync("MANAGER");
        if (managerRole != null && request.User != null && !request.User.Roles.Any(r => r.Name == "MANAGER"))
        { request.User.Roles.Add(managerRole); await _userRepo.UpdateAsync(request.User); }

        await _requestRepo.UpdateAsync(request);
        return new AdminApproveResult { UserId = request.UserId, Note = note };
    }

    public async Task<AdminRejectResult> RejectManagerRequestAsync(Guid requestId, Guid adminId, string? note)
    {
        var request = await _requestRepo.GetWithUserAndRolesAsync(requestId) ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ yêu cầu này.");
        if (request.Status != "PENDING") throw new InvalidOperationException($"Hồ sơ đã được xử lý ({request.Status}).");
        if (string.IsNullOrWhiteSpace(note)) throw new InvalidOperationException("Vui lòng nhập lý do từ chối.");
        request.Status = "REJECTED"; request.AdminUserId = adminId; request.DecisionAt = DateTime.UtcNow; request.DecisionNote = note;
        await _requestRepo.UpdateAsync(request);
        return new AdminRejectResult { UserId = request.UserId, Note = note };
    }

    public async Task<object> GetBookingStatsAsync(string? status, string? startDate, string? endDate, string? search, string? bookingType, int page, int pageSize)
    {
        if (page <= 0) page = 1; if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        DateTime? sinceUtc = null, untilUtc = null;
        if (!string.IsNullOrWhiteSpace(startDate) && DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dsLocal))
            sinceUtc = TimeZoneHelper.ToUtc(dsLocal.Date);
        if (!string.IsNullOrWhiteSpace(endDate) && DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var deLocal))
            untilUtc = TimeZoneHelper.ToUtc(deLocal.Date.AddDays(1));

        var totalItems = await _bookingRepo.CountAllFilteredAsync(status, sinceUtc, untilUtc, search, bookingType);
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
        var confirmed = await _bookingRepo.CountAllByStatusAsync("CONFIRMED", status, sinceUtc, untilUtc, search, bookingType);
        var pending = await _bookingRepo.CountAllByStatusAsync("PENDING", status, sinceUtc, untilUtc, search, bookingType);
        var cancelled = await _bookingRepo.CountAllByStatusAsync("CANCELLED", status, sinceUtc, untilUtc, search, bookingType);

        var vnTz = TimeZoneHelper.GetVietnamTz();
        var bookings = await _bookingRepo.GetAllPagedAsync(status, sinceUtc, untilUtc, search, bookingType, (page - 1) * pageSize, pageSize);
        var pagedItems = bookings.Select(b =>
        {
            var bookingCode = "SU" + b.Id.ToString("N")[^6..].ToUpperInvariant();
            var payment = b.Payments.OrderByDescending(p => p.CreatedAt).FirstOrDefault();
            var paymentStatus = payment?.Status?.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true ? "PAID" : "UNPAID";

            return new ManagerBookingListItemDto
            {
                BookingId = b.Id,
                BookingCode = bookingCode,
                Status = b.Status,
                SeriesId = b.SeriesId,
                IsLongTerm = b.SeriesId != null,
                ContactName = b.ContactName,
                ContactPhone = b.ContactPhone,
                GuestNote = b.GuestNote,
                ManagerStatusNote = b.ManagerStatusNote,
                TotalAmount = b.FinalAmount ?? b.TotalAmount,
                VenueName = b.Venue?.Name,
                VenueAddress = b.Venue?.Address,
                PlayerName = b.User?.FullName,
                PlayerPhone = b.ContactPhone ?? b.User?.PhoneNumber,
                PlayerAvatarUrl = b.User?.AvatarFile?.FileUrl,
                PaymentStatus = paymentStatus,
                PaymentMethod = payment?.Method,
                ProofUrl = payment?.GatewayReference,
                CreatedAt = b.CreatedAt,
                Items = b.BookingItems.OrderBy(bi => bi.StartTime).Select(bi =>
                {
                    var court = bi.Court;
                    return new ManagerBookingItemDto
                    {
                        CourtName = court?.Name,
                        CourtImageUrl = court?.Files?.FirstOrDefault()?.FileUrl,
                        StartTime = bi.StartTime,
                        EndTime = bi.EndTime
                    };
                }).ToList()
            };
        }).ToList();

        return new { summary = new { total = totalItems, confirmed, pending, cancelled }, items = pagedItems, totalItems, totalPages };
    }

    public async Task<object> GetRevenueStatsAsync(string? startDate, string? endDate)
    {
        DateTime? rangeStart = null, rangeEnd = null;
        if (!string.IsNullOrWhiteSpace(startDate) && DateTime.TryParseExact(startDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var rs))
            rangeStart = TimeZoneHelper.ToUtc(rs.Date);
        if (!string.IsNullOrWhiteSpace(endDate) && DateTime.TryParseExact(endDate.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var re))
            rangeEnd = TimeZoneHelper.ToUtc(re.Date.AddDays(1));

        var activeVenuesCount = await _venueRepo.CountActiveAsync();
        var penaltyRevenue = await _refundRepo.SumAllPenaltyAsync(rangeStart, rangeEnd);
        var venuePenalties = await _refundRepo.GetPenaltyByVenuesAsync(rangeStart, rangeEnd);
        var venues = await _venueRepo.GetActiveWithBookingStatsAsync(rangeStart, rangeEnd, DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow);
        
        var venuesStats = venues.Select(v =>
        {
            var bookings = v.Bookings ?? (ICollection<DAL.Models.Booking>)new List<DAL.Models.Booking>();
            var revenueRaw = bookings.Where(b => PaidStatuses.Contains(b.Status) && (rangeStart == null || b.CreatedAt >= rangeStart) && (rangeEnd == null || b.CreatedAt < rangeEnd)).Sum(b => b.FinalAmount ?? 0);
            var venuePenalty = venuePenalties.TryGetValue(v.Id, out var p) ? p : 0m;
            var filteredBookingsCount = bookings.Count(b => PaidStatuses.Contains(b.Status) && (rangeStart == null || b.CreatedAt >= rangeStart) && (rangeEnd == null || b.CreatedAt < rangeEnd));
            return new { id = v.Id, venue = v.Name, owner = v.OwnerUser?.FullName ?? "N/A", totalBookings = filteredBookingsCount, revenue = revenueRaw + venuePenalty };
        }).OrderByDescending(v => v.revenue).ToList();

        var dynamicTotalRevenue = venuesStats.Sum(v => v.revenue);
        var dynamicTotalBookings = venuesStats.Sum(v => v.totalBookings);

        return new { summary = new { totalRevenue = $"{dynamicTotalRevenue:N0} ₫", totalBookings = dynamicTotalBookings, activeVenues = activeVenuesCount, penaltyRevenue }, venuesData = venuesStats };
    }
}

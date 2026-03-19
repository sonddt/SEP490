import { useState, useMemo, useCallback, useEffect } from 'react';
import { MOCK_BOOKINGS } from '../../data/bookingsMock';
import BookingTabs from '../../components/manager/BookingTabs';
import BookingFilters from '../../components/manager/BookingFilters';
import BookingTable from '../../components/manager/BookingTable';
import BookingPagination from '../../components/manager/BookingPagination';
import RejectModal from '../../components/manager/RejectModal';
import BookingDetailModal from '../../components/manager/BookingDetailModal';

const PAGE_SIZE_DEFAULT = 5;

/* ── Date helpers ─────────────────────────────────────────────────── */
function isToday(dateStr) {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const n = new Date();
  const startOfWeek = new Date(n);
  startOfWeek.setDate(n.getDate() - n.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}
function isThisMonth(dateStr) {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

export default function ManagerBookings() {
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeTab, search, timeFilter, sortBy]);

  // Tab counts (all bookings, not filtered)
  const counts = useMemo(() => {
    return bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
  }, [bookings]);

  // Filtered + sorted + paginated
  const processedBookings = useMemo(() => {
    let list = bookings.filter((b) => b.status === activeTab);

    // Time filter
    if (timeFilter === 'today')  list = list.filter((b) => isToday(b.date));
    if (timeFilter === 'week')   list = list.filter((b) => isThisWeek(b.date));
    if (timeFilter === 'month')  list = list.filter((b) => isThisMonth(b.date));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((b) =>
        b.player.toLowerCase().includes(q) ||
        b.court.toLowerCase().includes(q) ||
        b.venue.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'newest')      return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest')      return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount_high') return b.amount - a.amount;
      if (sortBy === 'amount_low')  return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [bookings, activeTab, search, timeFilter, sortBy]);

  const totalPages  = Math.max(1, Math.ceil(processedBookings.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = processedBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Simulate load when tab changes
  const handleTabChange = useCallback((tab) => {
    setLoading(true);
    setActiveTab(tab);
    setTimeout(() => setLoading(false), 350);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  /* ── Actions ──────────────────────────────────────────────────── */
  const handleAccept = useCallback((id) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'UPCOMING' } : b));
    showToast('Đã chấp nhận yêu cầu đặt sân!', 'success');
  }, []);

  const handleRejectConfirm = useCallback((id, reason) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'REJECTED', rejectReason: reason } : b));
    setRejectModal(null);
    showToast('Đã từ chối yêu cầu đặt sân.', 'warning');
  }, []);

  const handleCancel = useCallback((id) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
    showToast('Đã huỷ lịch đặt sân.', 'info');
  }, []);

  /* ── Revenue of current tab ───────────────────────────────────── */
  const tabRevenue = useMemo(() => {
    return bookings
      .filter((b) => b.status === activeTab && b.paymentStatus === 'PAID')
      .reduce((s, b) => s + b.amount, 0);
  }, [bookings, activeTab]);

  return (
    <>
      {/* Toast notification */}
      {toastMsg && (
        <div
          className={`bk-toast bk-toast--${toastMsg.type}`}
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            animation: 'bkToastIn 0.3s ease',
          }}
        >
          <i className={
            toastMsg.type === 'success' ? 'feather-check-circle'
            : toastMsg.type === 'warning' ? 'feather-alert-circle'
            : 'feather-info'
          } />
          {toastMsg.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4">
        <BookingTabs
          activeTab={activeTab}
          counts={counts}
          onChange={handleTabChange}
        />
      </div>

      {/* Summary banner */}
      {activeTab === 'PENDING' && counts.PENDING > 0 && (
        <div className="bk-banner mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-banner-icon">
              <i className="feather-bell" />
            </div>
            <div>
              <strong>Có {counts.PENDING} yêu cầu đang chờ duyệt!</strong>
              <span className="d-block text-muted" style={{ fontSize: 13 }}>
                Vui lòng xem xét và phê duyệt các yêu cầu đặt sân mới nhất từ người chơi.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Revenue row for current tab */}
      <div className="row g-3 mb-4">
        <div className="col-sm-4">
          <div className="bk-stat-card">
            <i className="feather-list bk-stat-card__icon" />
            <div>
              <div className="bk-stat-card__label">Tổng đặt sân ({activeTab === 'PENDING' ? 'chờ duyệt' : activeTab === 'UPCOMING' ? 'sắp tới' : activeTab === 'COMPLETED' ? 'hoàn thành' : activeTab === 'REJECTED' ? 'từ chối' : 'đã huỷ'})</div>
              <div className="bk-stat-card__value">{processedBookings.length}</div>
            </div>
          </div>
        </div>
        {(activeTab === 'UPCOMING' || activeTab === 'COMPLETED') && (
          <div className="col-sm-4">
            <div className="bk-stat-card">
              <i className="feather-trending-up bk-stat-card__icon" style={{ color: '#097E52' }} />
              <div>
                <div className="bk-stat-card__label">Doanh thu đã thanh toán</div>
                <div className="bk-stat-card__value" style={{ color: '#097E52' }}>
                  {tabRevenue.toLocaleString('vi-VN')} ₫
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'PENDING' && (
          <div className="col-sm-4">
            <div className="bk-stat-card">
              <i className="feather-clock bk-stat-card__icon" style={{ color: '#f59e0b' }} />
              <div>
                <div className="bk-stat-card__label">Chờ phê duyệt</div>
                <div className="bk-stat-card__value" style={{ color: '#f59e0b' }}>{counts.PENDING || 0}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <BookingFilters
        search={search}
        onSearch={setSearch}
        timeFilter={timeFilter}
        onTimeFilter={setTimeFilter}
        sortBy={sortBy}
        onSortBy={setSortBy}
        total={processedBookings.length}
        showing={pageItems.length}
      />

      {/* Table */}
      <BookingTable
        bookings={pageItems}
        loading={loading}
        search={search}
        onView={setDetailModal}
        onAccept={handleAccept}
        onReject={setRejectModal}
        onCancel={handleCancel}
      />

      {/* Pagination */}
      <div className="mt-3">
        <BookingPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={processedBookings.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
        />
      </div>

      {/* Modals */}
      <BookingDetailModal
        booking={detailModal}
        onClose={() => setDetailModal(null)}
        onAccept={handleAccept}
        onReject={(b) => { setDetailModal(null); setRejectModal(b); }}
      />

      <RejectModal
        booking={rejectModal}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectModal(null)}
      />
    </>
  );
}

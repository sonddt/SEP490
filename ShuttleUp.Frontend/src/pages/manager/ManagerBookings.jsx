import { useState, useMemo, useCallback, useEffect } from 'react';
import { MOCK_BOOKINGS } from '../../data/bookingsMock';
import BookingTabs from '../../components/manager/BookingTabs';
import BookingFilters from '../../components/manager/BookingFilters';
import BookingTable from '../../components/manager/BookingTable';
import BookingPagination from '../../components/manager/BookingPagination';
import RejectModal from '../../components/manager/RejectModal';
import BookingDetailModal from '../../components/manager/BookingDetailModal';

const PAGE_SIZE_DEFAULT = 5;

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

  useEffect(() => { setPage(1); }, [activeTab, search, timeFilter, sortBy]);

  const counts = useMemo(() => {
    return bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
  }, [bookings]);

  const processedBookings = useMemo(() => {
    let list = bookings.filter((b) => b.status === activeTab);
    if (timeFilter === 'today')  list = list.filter((b) => isToday(b.date));
    if (timeFilter === 'week')   list = list.filter((b) => isThisWeek(b.date));
    if (timeFilter === 'month')  list = list.filter((b) => isThisMonth(b.date));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((b) =>
        b.player.toLowerCase().includes(q) ||
        b.court.toLowerCase().includes(q) ||
        b.venue.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
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

  const handleTabChange = useCallback((tab) => {
    setLoading(true);
    setActiveTab(tab);
    setTimeout(() => setLoading(false), 350);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

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

  const tabRevenue = useMemo(() => {
    return bookings
      .filter((b) => b.status === activeTab && b.paymentStatus === 'PAID')
      .reduce((s, b) => s + b.amount, 0);
  }, [bookings, activeTab]);

  return (
    <div className="bk-page-wrap">
      {/* Toast */}
      {toastMsg && (
        <div
          className={`bk-toast bk-toast--${toastMsg.type}`}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, animation: 'bkToastIn 0.3s ease' }}
        >
          <i className={toastMsg.type === 'success' ? 'feather-check-circle' : toastMsg.type === 'warning' ? 'feather-alert-circle' : 'feather-info'} />
          {toastMsg.msg}
        </div>
      )}

      {/* Banner */}
      {activeTab === 'PENDING' && counts.PENDING > 0 && (
        <div className="bk-banner">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-banner-icon"><i className="feather-bell" /></div>
            <div>
              <strong style={{ fontSize: 15 }}>Có {counts.PENDING} yêu cầu đang chờ duyệt!</strong>
              <span className="d-block" style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>
                Vui lòng xem xét và phê duyệt các yêu cầu đặt sân mới nhất.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="bk-stats-strip">
        <div className="bk-stat-card">
          <i className="feather-list bk-stat-card__icon" />
          <div>
            <div className="bk-stat-card__label">
              Tổng ({activeTab === 'PENDING' ? 'chờ duyệt' : activeTab === 'UPCOMING' ? 'sắp tới' : activeTab === 'COMPLETED' ? 'hoàn thành' : activeTab === 'REJECTED' ? 'từ chối' : 'đã huỷ'})
            </div>
            <div className="bk-stat-card__value">{processedBookings.length}</div>
          </div>
        </div>
        {(activeTab === 'UPCOMING' || activeTab === 'COMPLETED') && (
          <div className="bk-stat-card">
            <i className="feather-trending-up bk-stat-card__icon" style={{ color: '#097E52' }} />
            <div>
              <div className="bk-stat-card__label">Doanh thu đã TT</div>
              <div className="bk-stat-card__value" style={{ color: '#097E52' }}>
                {tabRevenue.toLocaleString('vi-VN')} ₫
              </div>
            </div>
          </div>
        )}
        {activeTab === 'PENDING' && (
          <div className="bk-stat-card">
            <i className="feather-clock bk-stat-card__icon" style={{ color: '#f59e0b' }} />
            <div>
              <div className="bk-stat-card__label">Chờ phê duyệt</div>
              <div className="bk-stat-card__value" style={{ color: '#f59e0b' }}>{counts.PENDING || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main card: Tabs + Filters + Table + Pagination */}
      <div className="card border-0">
        {/* Tabs */}
        <div style={{ padding: '0 20px', paddingTop: 16 }}>
          <BookingTabs activeTab={activeTab} counts={counts} onChange={handleTabChange} />
        </div>

        {/* Filters */}
        <BookingFilters
          search={search} onSearch={setSearch}
          timeFilter={timeFilter} onTimeFilter={setTimeFilter}
          sortBy={sortBy} onSortBy={setSortBy}
          total={processedBookings.length} showing={pageItems.length}
        />

        {/* Table */}
        <BookingTable
          bookings={pageItems} loading={loading} search={search}
          onView={setDetailModal} onAccept={handleAccept}
          onReject={setRejectModal} onCancel={handleCancel}
        />

        {/* Pagination */}
        <BookingPagination
          currentPage={currentPage} totalPages={totalPages}
          totalItems={processedBookings.length} pageSize={pageSize}
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
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import axiosClient from '../../api/axiosClient';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
import { BOOKING_STATUSES } from '../../data/bookingsMock';
import { mapManagerBookingFromApi } from '../manager/ManagerBookings';
import BookingDetailModal from '../../components/manager/BookingDetailModal';

export default function AdminBookingsStats() {
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType,   setFilterType]   = useState('All');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [searchText,   setSearchText]   = useState('');

  const [data,    setData]    = useState(null);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), pageSize: '15' });
      // Nếu lọc là UPCOMING thì backend dùng CONFIRMED (mapManagerBookingFromApi sẽ tự chuyển thành UPCOMING nếu chưa đá)
      let statusToSent = filterStatus;
      if (filterStatus === 'UPCOMING') statusToSent = 'CONFIRMED';
      
      if (statusToSent && statusToSent !== 'All') params.append('status', statusToSent);
      if (filterType && filterType !== 'All') params.append('bookingType', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate',   endDate);
      if (searchText.trim()) params.append('search', searchText.trim());

      const result = await axiosClient.get(`/admin/stats/bookings?${params}`);
      
      // Map kết quả API thành format ManagerBookingListItemDto chuẩn
      if (result && result.items) {
        result.items = result.items.map(mapManagerBookingFromApi);
      }
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, startDate, endDate, searchText]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [filterStatus, filterType, startDate, endDate, searchText]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '1000' });
      let statusToSent = filterStatus;
      if (filterStatus === 'UPCOMING') statusToSent = 'CONFIRMED';

      if (statusToSent && statusToSent !== 'All') params.append('status', statusToSent);
      if (filterType && filterType !== 'All') params.append('bookingType', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate',   endDate);
      if (searchText.trim()) params.append('search', searchText.trim());
      
      const result = await axiosClient.get(`/admin/stats/bookings?${params}`);
      let rowsToExport = [];
      if (result && result.items) {
        const mappedItems = result.items.map(mapManagerBookingFromApi);
        rowsToExport = mappedItems.map((b, i) => ({
          'STT':          i + 1,
          'Mã đặt':       b.bookingCode,
          'Người chơi':   b.player,
          'Sân':          b.venue,
          'Ngày đặt':     b.createdAt,
          'Ngày & Giờ chơi': `${b.dateDisplay} (${b.timeStart} - ${b.timeEnd})`,
          'Tiền (VNĐ)':   b.amount,
          'Trạng thái':   BOOKING_STATUSES[b.status]?.label || b.status,
        }));
      }

      const ws = XLSX.utils.json_to_sheet(rowsToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Đặt sân');
      XLSX.writeFile(wb, `thong-ke-dat-san-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // ignore
    }
  };

  const STAT_CONFIG = [
    { key: 'total',     label: 'Tổng đặt sân',       icon: 'feather-calendar',     theme: 'indigo' },
    { key: 'confirmed', label: 'Đặt thành công',      icon: 'feather-check-circle', theme: 'green'  },
    { key: 'pending',   label: 'Đang chờ xác nhận',   icon: 'feather-clock',        theme: 'amber'  },
    { key: 'cancelled', label: 'Đã huỷ',              icon: 'feather-x-circle',     theme: 'red'    },
  ];

  return (
    <>
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i className="feather-alert-triangle me-2" />Không thể tải dữ liệu: {error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={fetchStats}>Thử lại</button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {STAT_CONFIG.map((s) => (
          <div key={s.key} className={`adm-stat-card adm-stat-card--${s.theme}`}>
            <div className="adm-stat-card__icon"><i className={s.icon} /></div>
            <div>
              <div className="adm-stat-card__label">{s.label}</div>
              <div className="adm-stat-card__value">{(data?.summary?.[s.key] ?? 0).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card card-tableset">
        <div className="card-body">
          {/* Header row */}
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
            <h4 className="mb-0">Chi tiết Đặt sân {data && `(${data.totalItems ?? 0})`}</h4>
            <button
              className="btn btn-sm"
              style={{ background: '#e8f5ee', color: '#097E52', border: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={handleExport}
              title="Xuất Excel"
            >
              <i className="feather-download" style={{ fontSize: 14 }} /> Xuất Excel
            </button>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            <select
              className="form-select"
              style={{ width: 180 }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="UPCOMING">Sắp tới</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã huỷ / Từ chối</option>
              <option value="PENDING_REFUND">Chờ hoàn tiền</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
            <select
              className="form-select"
              style={{ width: 140 }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">Tất cả loại</option>
              <option value="SINGLE">Lịch đơn</option>
              <option value="LONG_TERM">Dài hạn</option>
            </select>
            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Từ ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Đến ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <i className="feather-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32 }}
                placeholder="Tìm người chơi, sân..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  onClick={() => setSearchText('')}
                ><i className="feather-x" /></button>
              )}
            </div>
            {(startDate || endDate || searchText || filterStatus !== 'All' || filterType !== 'All') && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setFilterStatus('All'); setFilterType('All'); setStartDate(''); setEndDate(''); setSearchText(''); }}
              >
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th>Mã đặt sân</th>
                  <th>Sân</th>
                  <th>Người đặt</th>
                  <th>Ngày đặt</th>
                  <th>Ngày & Giờ chơi</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th className="text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="8">
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: 30 }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !data?.items?.length ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">Không có dữ liệu.</td>
                  </tr>
                ) : data.items.map((b) => {
                  const st = BOOKING_STATUSES[b.status] || BOOKING_STATUSES.PENDING;
                  return (
                    <tr key={b.id}>
                      <td>
                        <code>{b.bookingCode}</code>
                        <div className="mt-1">
                          {b.isLongTerm ? (
                            <span className="badge" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}>Dài hạn</span>
                          ) : (
                            <span className="badge" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff' }}>Lịch đơn</span>
                          )}
                        </div>
                      </td>
                      <td title={b.venue} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.venue}
                      </td>
                      <td title={b.player} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>{b.player}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#334155' }}>{b.createdDateStr}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.createdTimeStr}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#334155' }}>{b.dateDisplay}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.timeStart} – {b.timeEnd}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#097E52', fontWeight: 600 }}>{b.amount.toLocaleString('vi-VN')} ₫</div>
                        <div style={{ fontSize: 11, color: b.paymentStatus === 'PAID' ? '#097E52' : '#94a3b8' }}>
                          {b.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </div>
                      </td>
                      <td>
                        <span 
                          className="badge" 
                          style={{ 
                            background: st.bg, 
                            color: st.color, 
                            border: `1px solid ${st.border}`, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4 
                          }}
                        >
                          <i className={st.icon} style={{ fontSize: 12 }} />
                          {st.label}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setDetailModal(b)}
                          title="Xem chi tiết"
                          style={{ width: 32, height: 32, padding: 0, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <i className="feather-eye" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && data && (data.totalPages ?? 0) > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                Trang {page} / {data.totalPages}
              </span>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <i className="feather-chevron-left" /> Trước
                </button>
                <button className="btn btn-sm btn-outline-secondary" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>
                  Sau <i className="feather-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {detailModal && (
        <BookingDetailModal
          booking={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </>
  );
}

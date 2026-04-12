import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import axiosClient from '../../api/axiosClient';

const STATUS_MAP = {
  CONFIRMED: { label: 'Xác nhận',  cls: 'bg-success' },
  COMPLETED: { label: 'Hoàn thành', cls: 'bg-success' },
  PENDING:   { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  CANCELLED: { label: 'Đã huỷ',   cls: 'bg-danger'  },
};

function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function AdminBookingsStats() {
  const [filterStatus, setFilterStatus] = useState('All');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [searchText,   setSearchText]   = useState('');

  const [data,    setData]    = useState(null);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), pageSize: '15' });
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate',   endDate);
      if (searchText.trim()) params.append('search', searchText.trim());

      const result = await axiosClient.get(`/admin/stats/bookings?${params}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, startDate, endDate, searchText]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [filterStatus, startDate, endDate, searchText]);

  const handleExport = async () => {
    try {
      // Fetch all for export (no paging)
      const params = new URLSearchParams({ page: '1', pageSize: '1000' });
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate',   endDate);
      if (searchText.trim()) params.append('search', searchText.trim());
      const result = await axiosClient.get(`/admin/stats/bookings?${params}`);
      const rows = (result.items || []).map((b, i) => ({
        'STT':          i + 1,
        'Mã đặt':       b.id,
        'Người chơi':   b.player,
        'Sân':          b.venue,
        'Sân con':      b.court,
        'Ngày':         b.date,
        'Giờ bắt đầu':  fmtTime(b.startTime),
        'Giờ kết thúc': fmtTime(b.endTime),
        'Tiền (VNĐ)':   b.amount,
        'Trạng thái':   STATUS_MAP[b.status]?.label || b.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
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
              <option value="CONFIRMED">Xác nhận</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
            <div className="d-flex align-items-center gap-1">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>Từ ngày</label>
              <input
                type="date"
                className="form-control"
                style={{ width: 160 }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="d-flex align-items-center gap-1">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>Đến ngày</label>
              <input
                type="date"
                className="form-control"
                style={{ width: 160 }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
            {(startDate || endDate || searchText || filterStatus !== 'All') && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setFilterStatus('All'); setStartDate(''); setEndDate(''); setSearchText(''); }}
              >
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th>Mã đặt</th>
                  <th>Người chơi</th>
                  <th>Sân</th>
                  <th>Sân con</th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Tiền</th>
                  <th>Trạng thái</th>
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
                ) : data.items.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.id}</code></td>
                    <td title={b.player} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{b.player}</strong>
                    </td>
                    <td title={b.venue} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.venue}
                    </td>
                    <td title={b.court} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.court}
                    </td>
                    <td>{b.date}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {b.startTime ? `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}` : 'N/A'}
                    </td>
                    <td><strong>{(b.amount ?? 0).toLocaleString('vi-VN')} ₫</strong></td>
                    <td>
                      <span className={`badge ${STATUS_MAP[b.status]?.cls || 'bg-secondary'}`}>
                        {STATUS_MAP[b.status]?.label || b.status}
                      </span>
                    </td>
                  </tr>
                ))}
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
    </>
  );
}

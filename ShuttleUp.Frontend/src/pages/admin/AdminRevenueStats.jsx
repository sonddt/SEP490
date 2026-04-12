import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

import axiosClient from '../../api/axiosClient';

export default function AdminRevenueStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const qs = params.toString();
      const result = await axiosClient.get(`/admin/stats/revenue${qs ? `?${qs}` : ''}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExport = () => {
    try {
      const rows = (data?.venuesData || []).map((v, idx) => ({
        'STT': idx + 1,
        'Sân': v.venue,
        'Chủ sân': v.owner,
        'Tổng đặt sân': v.totalBookings,
        'Doanh thu (VNĐ)': v.revenue,
        'Doanh thu tháng này (VNĐ)': v.thisMonthRevenue,
        'Doanh thu tháng trước (VNĐ)': v.prevMonthRevenue,
        'Tăng trưởng': v.growth,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Doanh thu');
      XLSX.writeFile(wb, `thong-ke-doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // ignore
    }
  };

  const STAT_CONFIG = [
    { key: 'totalRevenue',  label: 'Tổng doanh thu',        icon: 'feather-dollar-sign',  theme: 'indigo', isText: true },
    { key: 'monthRevenue',  label: 'Doanh thu tháng này',   icon: 'feather-trending-up',  theme: 'green',  isText: true },
    { key: 'todayRevenue',  label: 'Doanh thu hôm nay',     icon: 'feather-activity',     theme: 'amber',  isText: true },
    { key: 'activeVenues',  label: 'Sân đang hoạt động',    icon: 'feather-map-pin',      theme: 'red',    isText: false },
  ];

  return (
    <>
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i className="feather-alert-triangle me-2"></i>Không thể tải dữ liệu: {error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={fetchStats}>Thử lại</button>
        </div>
      )}

      {/* ── Revenue Summary Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {STAT_CONFIG.map((s) => (
          <div key={s.key} className={`adm-stat-card adm-stat-card--${s.theme}`}>
            <div className="adm-stat-card__icon">
              <i className={s.icon} />
            </div>
            <div>
              <div className="adm-stat-card__label">{s.label}</div>
              <div className="adm-stat-card__value" style={s.isText ? { fontSize: 22 } : {}}>
                {s.isText
                  ? (data?.summary?.[s.key] || '0 ₫')
                  : (data?.summary?.[s.key]?.toString() || '0')
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue by Venue Table ────────────────────── */}
      <div className="card card-tableset">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="mb-1">Doanh thu theo Sân</h4>
              <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Tổng hợp doanh thu của từng địa điểm</p>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: '#e8f5ee', color: '#097E52', border: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={handleExport}
              title="Xuất Excel"
              disabled={loading || !(data?.venuesData?.length > 0)}
            >
              <i className="feather-download" style={{ fontSize: 14 }} /> Xuất Excel
            </button>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-3">
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
            {(startDate || endDate) && (
              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th>#</th>
                  <th>Tên Sân</th>
                  <th>Chủ sân</th>
                  <th>Tổng đặt sân</th>
                  <th>Doanh thu</th>
                  <th>Tăng trưởng</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="6">
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: '30px' }}></span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !data?.venuesData || data.venuesData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">Không có dữ liệu.</td>
                  </tr>
                ) : (data.venuesData.map((v, idx) => (
                  <tr key={v.id}>
                    <td className="text-muted">{idx + 1}</td>
                    <td><strong>{v.venue}</strong></td>
                    <td>{v.owner}</td>
                    <td>{v.totalBookings.toLocaleString()} lượt</td>
                    <td><strong className="text-success">{v.revenue.toLocaleString()} ₫</strong></td>
                    <td>
                      <span className={`badge ${v.growth?.startsWith('+') ? 'bg-success' : (v.growth?.startsWith('-') ? 'bg-danger' : 'bg-secondary')}`}>
                        {v.growth}
                      </span>
                    </td>
                  </tr>
                )))}
              </tbody>
              {!loading && data?.venuesData && data.venuesData.length > 0 && (
                <tfoot>
                  <tr className="table-light fw-bold">
                    <td colSpan={3}>Tổng cộng</td>
                    <td>{data.venuesData.reduce((a, v) => a + v.totalBookings, 0).toLocaleString()} lượt</td>
                    <td className="text-success">{data.summary?.totalRevenue}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

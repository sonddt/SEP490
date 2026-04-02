import { useState, useEffect, useCallback } from 'react';

import axiosClient from '../../api/axiosClient';

export default function AdminRevenueStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await axiosClient.get(`/admin/stats/revenue`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
                      <span className={`badge ${v.growth.startsWith('+') ? 'bg-success' : 'bg-secondary'}`}>
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

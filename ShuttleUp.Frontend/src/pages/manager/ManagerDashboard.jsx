import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { notifyError } from '../../hooks/useNotification';

const STATUS_MAP = {
  CONFIRMED: { label: 'Xác nhận',  badge: 'bg-success', icon: 'feather-check-circle' },
  PENDING:   { label: 'Chờ xử lý', badge: 'bg-warning', icon: 'feather-clock' },
  CANCELLED: { label: 'Đã huỷ',    badge: 'bg-danger',  icon: 'feather-x-circle' },
};

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get('/manager/stats/overview');
        if (!mounted) return;
        setOverview(res);
      } catch (e) {
        if (!mounted) return;
        setOverview(null);
        notifyError(e?.response?.data?.message || 'Oops… Không tải được thống kê tổng quan.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const o = overview || {};
    const money = (v) => `${(v ?? 0).toLocaleString('vi-VN')} ₫`;
    return [
      { label: 'Tổng cụm sân',        value: (o.totalVenues ?? 0).toLocaleString('vi-VN'), icon: 'feather-map-pin',     variant: 'green' },
      { label: 'Đặt sân hôm nay',     value: (o.todayBookings ?? 0).toLocaleString('vi-VN'), icon: 'feather-calendar',    variant: 'blue' },
      { label: 'Doanh thu tháng này', value: money(o.monthRevenue ?? 0), icon: 'feather-trending-up', variant: 'amber' },
      { label: 'Chờ xử lý',           value: (o.pendingCount ?? 0).toLocaleString('vi-VN'), icon: 'feather-clock',       variant: 'red' },
    ];
  }, [overview]);

  const recentBookings = overview?.recentBookings || [];

  const fmtTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className={`mgr-stat-card mgr-stat-card--${s.variant}`}>
              <div className="mgr-stat-card__icon">
                <i className={s.icon} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Recent Bookings */}
        <div className="col-lg-8">
          <div className="card card-tableset border-0 h-100">
            <div className="card-body">
              <div className="coache-head-blk" style={{ borderBottom: 'none' }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="court-table-head">
                    <h4>Đặt sân gần đây</h4>
                    <p>Các lịch đặt sân mới nhất</p>
                  </div>
                  <Link to="/manager/bookings" className="btn btn-sm btn-outline-secondary">
                    Xem tất cả
                  </Link>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Người chơi</th>
                      <th>Sân</th>
                      <th>Ngày</th>
                      <th>Tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={5}>
                            <div className="placeholder-glow">
                              <span className="placeholder col-12" style={{ height: 28 }} />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : recentBookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">Chưa có booking nào.</td>
                      </tr>
                    ) : recentBookings.map(b => {
                      const st = STATUS_MAP[b.status] || STATUS_MAP.PENDING;
                      return (
                        <tr key={b.id}>
                          <td>
                            <h2 className="table-avatar d-flex align-items-center gap-2 mb-0" style={{ minWidth: 180 }}>
                              <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                                <img className="avatar-img rounded-circle" src={'/assets/img/profiles/avatar-01.jpg'} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                              </span>
                              <span className="table-head-name flex-grow-1 text-truncate text-nowrap" style={{ fontSize: 14 }}>
                                <a href="#!" onClick={e => e.preventDefault()} style={{ color: '#1e293b', fontWeight: 600 }}>{b.player}</a>
                              </span>
                            </h2>
                          </td>
                          <td>
                            <span style={{ fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 220 }}>
                              {b.court} · {b.venue}
                            </span>
                          </td>
                          <td className="table-date-time">
                            <h4>{b.date}<span><i className="feather-clock" style={{ fontSize: 11, marginRight: 3 }} />{b.startTime ? `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}` : '—'}</span></h4>
                          </td>
                          <td>
                            <span className="pay-dark">{(b.amount ?? 0).toLocaleString('vi-VN')} ₫</span>
                          </td>
                          <td>
                            <span className={`badge ${st.badge}`}><i className={st.icon} />{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-lg-4">
          <div className="card card-tableset border-0">
            <div className="card-body" style={{ padding: '24px' }}>
              <div className="court-table-head" style={{ marginBottom: 20 }}>
                <h4>Thao tác nhanh</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/manager/venues/add" className="btn btn-secondary d-inline-flex align-items-center justify-content-center" style={{ padding: '12px 18px', fontSize: 15 }}>
                  <i className="feather-plus-circle me-2" /> Thêm cụm sân mới
                </Link>
                <Link to="/manager/venues" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center" style={{ padding: '12px 18px', fontSize: 15 }}>
                  <i className="feather-map-pin me-2" /> Quản lý cụm sân
                </Link>
                <Link to="/manager/earnings" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center" style={{ padding: '12px 18px', fontSize: 15 }}>
                  <i className="feather-bar-chart-2 me-2" /> Báo cáo doanh thu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

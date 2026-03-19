import { useState } from 'react';
import { Link } from 'react-router-dom';

const MOCK_VENUES = [
  {
    id: 'v1', name: 'ShuttleUp Quận 7',
    address: '12 Nguyễn Thị Thập, Q.7, TP.HCM',
    image: '/assets/img/venue/venue-01.jpg',
    courtCount: 3, activeCourts: 3,
    totalBookingsThisMonth: 42, revenueThisMonth: 12400000,
    status: 'active', createdAt: '01/01/2026',
  },
  {
    id: 'v2', name: 'ShuttleUp Bình Thạnh',
    address: '45 Đinh Tiên Hoàng, Q.Bình Thạnh, TP.HCM',
    image: '/assets/img/venue/venue-02.jpg',
    courtCount: 2, activeCourts: 2,
    totalBookingsThisMonth: 28, revenueThisMonth: 8500000,
    status: 'active', createdAt: '15/01/2026',
  },
  {
    id: 'v3', name: 'Cầu lông Gò Vấp',
    address: '88 Quang Trung, Q.Gò Vấp, TP.HCM',
    image: '/assets/img/venue/venue-03.jpg',
    courtCount: 4, activeCourts: 2,
    totalBookingsThisMonth: 15, revenueThisMonth: 3200000,
    status: 'inactive', createdAt: '01/02/2026',
  },
];

const STATUS_STYLES = {
  active:   { label: 'Hoạt động', bg: '#dcfce7', color: '#15803d' },
  inactive: { label: 'Tạm ngưng', bg: '#f1f5f9', color: '#64748b' },
  pending:  { label: 'Chờ duyệt', bg: '#fef3c7', color: '#d97706' },
};

export default function ManagerVenueList() {
  const [venues, setVenues] = useState(MOCK_VENUES);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteModal, setDeleteModal] = useState(null);

  const filtered = venues.filter((v) => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase())
      || v.address.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleDelete = () => {
    if (!deleteModal) return;
    setVenues((prev) => prev.filter((v) => v.id !== deleteModal.id));
    setDeleteModal(null);
  };

  const totalCourts   = venues.reduce((s, v) => s + v.courtCount, 0);
  const totalBookings = venues.reduce((s, v) => s + v.totalBookingsThisMonth, 0);
  const totalRevenue  = venues.reduce((s, v) => s + v.revenueThisMonth, 0);

  return (
    <>
      {/* Summary stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Tổng cụm sân', value: venues.length, icon: 'feather-map-pin', color: '#0d7c5f', bg: '#e8f5ee' },
          { label: 'Tổng sân', value: totalCourts, icon: 'feather-grid', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Đặt sân tháng này', value: totalBookings, icon: 'feather-calendar', color: '#d97706', bg: '#fffbeb' },
          { label: 'Doanh thu tháng', value: totalRevenue.toLocaleString('vi-VN') + ' ₫', icon: 'feather-trending-up', color: '#10b981', bg: '#ecfdf5' },
        ].map((s) => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="mgr-stat-card">
              <div className="mgr-stat-card__icon" style={{ background: s.bg }}>
                <i className={s.icon} style={{ color: s.color }} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card border-0 mb-4">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="bk-search-wrap" style={{ flex: '1 1 280px', maxWidth: 400 }}>
              <i className="feather-search bk-search-icon" />
              <input
                type="text"
                className="form-control bk-search-input"
                placeholder="Tìm kiếm cụm sân..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="bk-search-clear" onClick={() => setSearch('')}>
                  <i className="feather-x" />
                </button>
              )}
            </div>
            <select
              className="form-select"
              style={{ width: 180, flex: '0 0 auto' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
              <option value="pending">Chờ duyệt</option>
            </select>
            <div style={{ marginLeft: 'auto' }}>
              <Link to="/manager/venues/add" className="btn btn-secondary">
                <i className="feather-plus-circle" />Thêm cụm sân mới
              </Link>
            </div>
            {search && (
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                {filtered.length} kết quả
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Venue cards */}
      {filtered.length === 0 ? (
        <div className="card border-0">
          <div className="card-body text-center" style={{ padding: '56px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <i className="feather-map-pin" style={{ fontSize: 28, color: '#94a3b8' }} />
            </div>
            <h5 style={{ color: '#334155', marginBottom: 6 }}>Không tìm thấy cụm sân nào</h5>
            <p className="text-muted mb-3">Hãy thêm cụm sân đầu tiên của bạn</p>
            <Link to="/manager/venues/add" className="btn btn-secondary btn-sm">
              <i className="feather-plus-circle" />Thêm cụm sân
            </Link>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filtered.map((venue) => {
            const st = STATUS_STYLES[venue.status] || STATUS_STYLES.active;
            return (
              <div key={venue.id} className="col-xl-4 col-md-6">
                <div className="mgr-venue-card">
                  <div className="mgr-venue-card__img">
                    <img
                      src={venue.image} alt={venue.name}
                      onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
                    />
                    <span className="mgr-venue-card__badge" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mgr-venue-card__body">
                    <Link to={`/manager/venues/${venue.id}/courts`} className="mgr-venue-card__name">
                      {venue.name}
                    </Link>
                    <div className="mgr-venue-card__addr">
                      <i className="feather-map-pin" style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }} />
                      {venue.address}
                    </div>
                    <div className="mgr-venue-card__stats">
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val">
                          {venue.activeCourts}<span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>/{venue.courtCount}</span>
                        </div>
                        <div className="mgr-venue-card__stat-lbl">Sân hoạt động</div>
                      </div>
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val">{venue.totalBookingsThisMonth}</div>
                        <div className="mgr-venue-card__stat-lbl">Đặt sân</div>
                      </div>
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val" style={{ color: '#097E52' }}>
                          {(venue.revenueThisMonth / 1000000).toFixed(1)}tr
                        </div>
                        <div className="mgr-venue-card__stat-lbl">Doanh thu</div>
                      </div>
                    </div>
                  </div>
                  <div className="mgr-venue-card__footer">
                    <Link to={`/manager/venues/${venue.id}/courts`} className="btn btn-sm btn-outline-secondary" style={{ flex: 1 }}>
                      <i className="feather-grid" />Xem sân
                    </Link>
                    <Link to={`/manager/venues/${venue.id}/edit`} className="btn btn-sm btn-outline-primary" style={{ flex: 1 }}>
                      <i className="feather-edit-2" />Sửa
                    </Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDeleteModal(venue)}
                      style={{ width: 40, padding: '7px 0', justifyContent: 'center' }}
                    >
                      <i className="feather-trash-2" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteModal && (
        <div className="mgr-delete-modal" onClick={() => setDeleteModal(null)}>
          <div className="mgr-delete-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="mgr-delete-modal__icon">
              <i className="feather-alert-triangle" />
            </div>
            <h5>Xoá cụm sân?</h5>
            <p>Bạn có chắc muốn xoá <strong>{deleteModal.name}</strong>? Tất cả sân và dữ liệu liên quan sẽ bị xoá.</p>
            <div className="mgr-delete-modal__actions">
              <button className="btn btn-outline-secondary" onClick={() => setDeleteModal(null)}>Huỷ</button>
              <button className="btn btn-danger" onClick={handleDelete}>Xoá cụm sân</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

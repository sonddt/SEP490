import { useState } from 'react';
import { Link } from 'react-router-dom';

const MOCK_VENUES = [
  {
    id: 'v1',
    name: 'ShuttleUp Quận 7',
    address: '12 Nguyễn Thị Thập, Q.7, TP.HCM',
    image: '/assets/img/venue/venue-01.jpg',
    courtCount: 3,
    activeCourts: 3,
    totalBookingsThisMonth: 42,
    revenueThisMonth: 12400000,
    status: 'active',
    createdAt: '01/01/2026',
  },
  {
    id: 'v2',
    name: 'ShuttleUp Bình Thạnh',
    address: '45 Đinh Tiên Hoàng, Q.Bình Thạnh, TP.HCM',
    image: '/assets/img/venue/venue-02.jpg',
    courtCount: 2,
    activeCourts: 2,
    totalBookingsThisMonth: 28,
    revenueThisMonth: 8500000,
    status: 'active',
    createdAt: '15/01/2026',
  },
  {
    id: 'v3',
    name: 'Cầu lông Gò Vấp',
    address: '88 Quang Trung, Q.Gò Vấp, TP.HCM',
    image: '/assets/img/venue/venue-03.jpg',
    courtCount: 4,
    activeCourts: 2,
    totalBookingsThisMonth: 15,
    revenueThisMonth: 3200000,
    status: 'inactive',
    createdAt: '01/02/2026',
  },
];

const statusMap = {
  active:   { label: 'Hoạt động', cls: 'bg-success' },
  inactive: { label: 'Tạm ngưng', cls: 'bg-secondary' },
  pending:  { label: 'Chờ duyệt', cls: 'bg-warning text-dark' },
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
          { label: 'Tổng cụm sân', value: venues.length, icon: 'feather-map-pin', color: '#0d7c5f' },
          { label: 'Tổng sân', value: totalCourts, icon: 'feather-grid', color: '#2563eb' },
          { label: 'Đặt sân tháng này', value: totalBookings, icon: 'feather-calendar', color: '#f59e0b' },
          { label: 'Doanh thu tháng', value: totalRevenue.toLocaleString('vi-VN') + ' ₫', icon: 'feather-trending-up', color: '#10b981' },
        ].map((s) => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3">
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: `${s.color}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <i className={s.icon} style={{ fontSize: 20, color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="row align-items-center g-3">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0"><i className="feather-search" style={{ fontSize: 15, color: '#94a3b8' }} /></span>
                <input
                  type="text" className="form-control border-start-0 ps-0"
                  placeholder="Tìm kiếm cụm sân..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
                <option value="pending">Chờ duyệt</option>
              </select>
            </div>
            <div className="col-md-5 text-md-end">
              <Link to="/manager/venues/add" className="btn btn-secondary">
                <i className="feather-plus-circle me-2" />Thêm cụm sân mới
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Venue cards */}
      {filtered.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="feather-map-pin" style={{ fontSize: 48, color: '#cbd5e1' }} />
            <p className="text-muted mt-3 mb-0">Không tìm thấy cụm sân nào</p>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filtered.map((venue) => (
            <div key={venue.id} className="col-xl-4 col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ overflow: 'hidden' }}>
                {/* Image */}
                <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                  <img
                    src={venue.image}
                    alt={venue.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
                  />
                  <span
                    className={`badge ${statusMap[venue.status].cls}`}
                    style={{ position: 'absolute', top: 12, right: 12, fontSize: 11 }}
                  >
                    {statusMap[venue.status].label}
                  </span>
                </div>

                {/* Body */}
                <div className="card-body">
                  <h5 className="mb-1" style={{ fontSize: 16, fontWeight: 700 }}>
                    <Link to={`/manager/venues/${venue.id}/courts`} style={{ color: '#1e293b', textDecoration: 'none' }}>
                      {venue.name}
                    </Link>
                  </h5>
                  <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                    <i className="feather-map-pin me-1" style={{ fontSize: 13 }} />{venue.address}
                  </p>

                  <div className="d-flex gap-4 mb-3" style={{ fontSize: 13 }}>
                    <div>
                      <span className="text-muted">Sân: </span>
                      <strong>{venue.activeCourts}/{venue.courtCount}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Đặt: </span>
                      <strong>{venue.totalBookingsThisMonth}</strong>
                    </div>
                    <div>
                      <span className="text-muted">DT: </span>
                      <strong className="text-success">{(venue.revenueThisMonth / 1000000).toFixed(1)}tr</strong>
                    </div>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="card-footer bg-white border-top d-flex gap-2" style={{ padding: '12px 16px' }}>
                  <Link to={`/manager/venues/${venue.id}/courts`} className="btn btn-sm btn-outline-secondary flex-fill">
                    <i className="feather-grid me-1" />Xem sân
                  </Link>
                  <Link to={`/manager/venues/${venue.id}/edit`} className="btn btn-sm btn-outline-primary flex-fill">
                    <i className="feather-edit-2 me-1" />Sửa
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => setDeleteModal(venue)}
                    style={{ width: 38 }}
                  >
                    <i className="feather-trash-2" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteModal(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0">
              <div className="modal-body text-center py-4">
                <div className="mb-3"><i className="feather-alert-triangle" style={{ fontSize: 48, color: '#ef4444' }} /></div>
                <h5>Xoá cụm sân?</h5>
                <p className="text-muted mb-0">Bạn có chắc muốn xoá <strong>{deleteModal.name}</strong>? Tất cả sân và dữ liệu liên quan sẽ bị xoá.</p>
                <div className="d-flex gap-2 justify-content-center mt-4">
                  <button className="btn btn-outline-secondary" onClick={() => setDeleteModal(null)}>Huỷ</button>
                  <button className="btn btn-danger" onClick={handleDelete}>Xoá</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

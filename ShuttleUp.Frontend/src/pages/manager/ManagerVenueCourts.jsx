import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const MOCK_COURTS = [
  { id: 1, venueId: 'v1', name: 'Sân 1', type: 'Đơn / Đôi', image: '/assets/img/booking/booking-01.jpg', pricePerHour: 120000, maxGuest: 4, surface: 'Gỗ PU', status: true, addedOn: '01/03/2026' },
  { id: 2, venueId: 'v1', name: 'Sân 2', type: 'Đơn / Đôi', image: '/assets/img/booking/booking-02.jpg', pricePerHour: 120000, maxGuest: 4, surface: 'Gỗ PU', status: true, addedOn: '01/03/2026' },
  { id: 3, venueId: 'v1', name: 'Sân 3', type: 'Đôi', image: '/assets/img/booking/booking-03.jpg', pricePerHour: 160000, maxGuest: 6, surface: 'Thảm nhựa', status: true, addedOn: '05/03/2026' },
  { id: 4, venueId: 'v1', name: 'Sân 4', type: 'Đơn', image: '/assets/img/booking/booking-04.jpg', pricePerHour: 100000, maxGuest: 2, surface: 'Xi-măng', status: false, addedOn: '10/03/2026' },
  { id: 5, venueId: 'v1', name: 'Sân 5', type: 'Đơn / Đôi', image: '/assets/img/booking/booking-05.jpg', pricePerHour: 120000, maxGuest: 4, surface: 'Gỗ PU', status: false, addedOn: '12/03/2026' },
];

export default function ManagerVenueCourts() {
  const { venueId } = useParams();
  const [courts, setCourts] = useState(MOCK_COURTS);
  const [filterTab, setFilterTab] = useState('all');
  const [timeFilter, setTimeFilter] = useState('week');
  const [sortBy, setSortBy] = useState('default');
  const [deleteModal, setDeleteModal] = useState(null);

  const toggleStatus = (id) => {
    setCourts((prev) => prev.map((c) => c.id === id ? { ...c, status: !c.status } : c));
  };

  const handleDelete = () => {
    if (!deleteModal) return;
    setCourts((prev) => prev.filter((c) => c.id !== deleteModal.id));
    setDeleteModal(null);
  };

  const filtered = courts.filter((c) => {
    if (filterTab === 'active') return c.status;
    if (filterTab === 'inactive') return !c.status;
    return true;
  });

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Quản lý sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/courts">Sân của tôi</Link></li>
            <li>Danh sách sân</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* Filter bar */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section court-sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="coach-court-list">
                        <ul className="nav">
                          {[
                            { key: 'all', label: 'Tất cả sân' },
                            { key: 'active', label: 'Đang hoạt động' },
                            { key: 'inactive', label: 'Tạm ngưng' },
                          ].map((t) => (
                            <li key={t.key}>
                              <a
                                href="#"
                                className={filterTab === t.key ? 'active' : ''}
                                onClick={(e) => { e.preventDefault(); setFilterTab(t.key); }}
                              >
                                {t.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="sortby-filter-group court-sortby">
                        <div className="sortbyset week-bg">
                          <div className="sorting-select">
                            <select className="form-control select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                              <option value="week">Tuần này</option>
                              <option value="month">Tháng này</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp</span>
                          <div className="sorting-select">
                            <select className="form-control select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                              <option value="default">Mặc định</option>
                              <option value="price">Theo giá</option>
                              <option value="name">Theo tên</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="row">
            <div className="col-sm-12">
              <div className="court-tab-content">
                <div className="card card-tableset">
                  <div className="card-body">
                    <div className="coache-head-blk">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <div className="court-table-head">
                            <h4>Danh sách sân trong cụm</h4>
                            <p>{filtered.length} sân · {courts.filter((c) => c.status).length} đang hoạt động</p>
                          </div>
                        </div>
                        <div className="col-md-6 text-md-end">
                          <Link to={`/manager/venues/${venueId || 'v1'}/courts/add`} className="btn btn-secondary">
                            <i className="feather-plus-circle me-2" />Thêm sân mới
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Tên sân</th>
                            <th>Loại</th>
                            <th>Mặt sân</th>
                            <th>Giá/giờ</th>
                            <th>Tối đa</th>
                            <th>Ngày thêm</th>
                            <th>Trạng thái</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-muted py-4">Không có sân nào</td></tr>
                          )}
                          {filtered.map((court) => (
                            <tr key={court.id}>
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img" src={court.image} alt="" />
                                  </span>
                                  <span className="table-head-name flex-grow-1 ms-2">
                                    <span>{court.name}</span>
                                  </span>
                                </h2>
                              </td>
                              <td>{court.type}</td>
                              <td>{court.surface}</td>
                              <td><span className="pay-dark">{court.pricePerHour.toLocaleString('vi-VN')} ₫</span></td>
                              <td>{court.maxGuest} người</td>
                              <td>{court.addedOn}</td>
                              <td>
                                <div className="status-toggle d-inline-flex align-items-center">
                                  <input
                                    type="checkbox" id={`cs_${court.id}`} className="check"
                                    checked={court.status}
                                    onChange={() => toggleStatus(court.id)}
                                  />
                                  <label htmlFor={`cs_${court.id}`} className="checktoggle">checkbox</label>
                                </div>
                              </td>
                              <td className="text-end">
                                <div className="dropdown dropdown-action table-drop-action">
                                  <button type="button" className="action-icon dropdown-toggle" data-bs-toggle="dropdown">
                                    <i className="fas fa-ellipsis-h" />
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                      <Link to={`/manager/venues/${venueId || 'v1'}/courts/${court.id}/edit`} className="dropdown-item">
                                        <i className="feather-edit me-2" />Chỉnh sửa
                                      </Link>
                                    </li>
                                    <li>
                                      <button type="button" className="dropdown-item text-danger" onClick={() => setDeleteModal(court)}>
                                        <i className="feather-trash me-2" />Xoá
                                      </button>
                                    </li>
                                  </ul>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDeleteModal(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <div className="mb-3">
                  <i className="feather-alert-triangle" style={{ fontSize: 48, color: '#ef4444' }} />
                </div>
                <h5>Xoá sân?</h5>
                <p className="text-muted">Bạn có chắc muốn xoá <strong>{deleteModal.name}</strong>? Hành động này không thể hoàn tác.</p>
                <div className="d-flex gap-2 justify-content-center mt-3">
                  <button className="btn btn-outline-secondary" onClick={() => setDeleteModal(null)}>Huỷ</button>
                  <button className="btn btn-danger" onClick={handleDelete}>Xoá</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

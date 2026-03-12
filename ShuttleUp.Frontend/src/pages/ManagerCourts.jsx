import { useState } from 'react';
import { Link } from 'react-router-dom';
import { managerCourtsMock } from '../data/managerCourtsMock';
import ManagerDashboardMenu from '../components/manager/ManagerDashboardMenu';

/**
 * Manager Courts - Danh sách sân (bảng) cho quản lý sân (all-court.html)
 */
export default function ManagerCourts() {
  const [courts, setCourts] = useState(managerCourtsMock);
  const [filterTab, setFilterTab] = useState('all'); // all | active | inactive
  const [timeRange, setTimeRange] = useState('week');
  const [sortBy, setSortBy] = useState('relevance');

  const toggleStatus = (id) => {
    setCourts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Sân của tôi</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Sân của tôi</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      {/* Page Content */}
      <div className="content court-bg">
        <div className="container">
          {/* Sort / Filter bar */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section court-sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="coach-court-list">
                        <ul className="nav">
                          <li>
                            <a
                              href="#"
                              className={filterTab === 'all' ? 'active' : ''}
                              onClick={(e) => { e.preventDefault(); setFilterTab('all'); }}
                            >
                              Tất cả sân
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className={filterTab === 'active' ? 'active' : ''}
                              onClick={(e) => { e.preventDefault(); setFilterTab('active'); }}
                            >
                              Đang hoạt động
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className={filterTab === 'inactive' ? 'active' : ''}
                              onClick={(e) => { e.preventDefault(); setFilterTab('inactive'); }}
                            >
                              Tạm ngưng
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="sortby-filter-group court-sortby">
                        <div className="sortbyset week-bg">
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={timeRange}
                              onChange={(e) => setTimeRange(e.target.value)}
                            >
                              <option value="week">Tuần này</option>
                              <option value="day">Hôm nay</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                            >
                              <option value="relevance">Mặc định</option>
                              <option value="price">Theo giá</option>
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
                            <h4>Danh sách sân</h4>
                            <p>Quản lý các sân cầu lông của bạn</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Tên sân</th>
                            <th>Địa điểm</th>
                            <th>Giá/giờ</th>
                            <th>Số người tối đa</th>
                            <th>Khách thêm</th>
                            <th>Ngày đăng</th>
                            <th>Chi tiết</th>
                            <th>Trạng thái</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {courts
                            .filter((c) => {
                              if (filterTab === 'active') return c.active;
                              if (filterTab === 'inactive') return !c.active;
                              return true;
                            })
                            .map((court) => (
                              <tr key={court.id}>
                                <td>
                                  <h2 className="table-avatar">
                                    <Link to="/venue-details" className="avatar avatar-sm flex-shrink-0">
                                      <img className="avatar-img" src={court.image} alt="" />
                                    </Link>
                                    <span className="table-head-name flex-grow-1">
                                      <Link to="/venue-details">{court.name}</Link>
                                      <span>{court.courtLabel}</span>
                                    </span>
                                  </h2>
                                </td>
                                <td>{court.location}</td>
                                <td><span className="pay-dark">{Number(court.amount).toLocaleString('vi-VN')} ₫</span></td>
                                <td>{court.maxGuest}</td>
                                <td>{court.additionalGuests}</td>
                                <td>{court.addedOn}</td>
                                <td className="text-pink view-detail-pink">
                                  <Link to={`/venue-details?id=${court.id}`}>
                                    <i className="feather-eye"></i> Xem chi tiết
                                  </Link>
                                </td>
                                <td className="table-inset-btn">
                                  <div className="interset-btn">
                                    <div className="status-toggle d-inline-flex align-items-center">
                                      <input
                                        type="checkbox"
                                        id={`status_${court.id}`}
                                        className="check"
                                        checked={court.active}
                                        onChange={() => toggleStatus(court.id)}
                                      />
                                      <label htmlFor={`status_${court.id}`} className="checktoggle">
                                        checkbox
                                      </label>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-end">
                                  <div className="dropdown dropdown-action table-drop-action">
                                    <button
                                      type="button"
                                      className="action-icon dropdown-toggle"
                                      data-bs-toggle="dropdown"
                                      aria-expanded="false"
                                    >
                                      <i className="fas fa-ellipsis-h"></i>
                                    </button>
                                    <ul className="dropdown-menu dropdown-menu-end">
                                      <li>
                                        <button type="button" className="dropdown-item">
                                          <i className="feather-edit"></i> Chỉnh sửa
                                        </button>
                                      </li>
                                      <li>
                                        <button type="button" className="dropdown-item text-danger">
                                          <i className="feather-trash"></i> Xoá
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
    </div>
  );
}

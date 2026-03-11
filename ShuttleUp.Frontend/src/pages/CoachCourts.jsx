import { useState } from 'react';
import { Link } from 'react-router-dom';
import { coachCourtsMock } from '../data/coachCourtsMock';

/**
 * Coach Courts - Danh sách sân (bảng) cho coach (all-court.html)
 */
export default function CoachCourts() {
  const [courts, setCourts] = useState(coachCourtsMock);
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
          <h1 className="text-white">Courts</h1>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li>Courts</li>
          </ul>
        </div>
      </section>

      {/* Dashboard Menu (from all-court.html) */}
      <div className="dashboard-section coach-dash-section">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="dashboard-menu coaurt-menu-dash">
                <ul>
                  <li>
                    <Link to="/coach/dashboard">
                      <img src="/assets/img/icons/dashboard-icon.svg" alt="" />
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/courts" className="active">
                      <img src="/assets/img/icons/court-icon.svg" alt="" />
                      <span>Courts</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/requests">
                      <img src="/assets/img/icons/request-icon.svg" alt="" />
                      <span>Requests</span>
                      <span className="court-notify">03</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/bookings">
                      <img src="/assets/img/icons/booking-icon.svg" alt="" />
                      <span>Bookings</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/chat">
                      <img src="/assets/img/icons/chat-icon.svg" alt="" />
                      <span>Chat</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/earnings">
                      <img src="/assets/img/icons/invoice-icon.svg" alt="" />
                      <span>Earnings</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/wallet">
                      <img src="/assets/img/icons/wallet-icon.svg" alt="" />
                      <span>Wallet</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/coach/profile">
                      <img src="/assets/img/icons/profile-icon.svg" alt="" />
                      <span>Profile Setting</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                              All Courts
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className={filterTab === 'active' ? 'active' : ''}
                              onClick={(e) => { e.preventDefault(); setFilterTab('active'); }}
                            >
                              Active Courts
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className={filterTab === 'inactive' ? 'active' : ''}
                              onClick={(e) => { e.preventDefault(); setFilterTab('inactive'); }}
                            >
                              Inactive Courts
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
                              <option value="week">This Week</option>
                              <option value="day">One Day</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sort By</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                            >
                              <option value="relevance">Relevance</option>
                              <option value="price">Price</option>
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
                            <h4>Courts</h4>
                            <p>Explore top-quality courts for your sporting activities</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Court Name</th>
                            <th>Location</th>
                            <th>Amount</th>
                            <th>Max Guest</th>
                            <th>Additional Guests</th>
                            <th>Added On</th>
                            <th>Details</th>
                            <th>Status</th>
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
                                <td><span className="pay-dark">${court.amount}</span></td>
                                <td>{court.maxGuest}</td>
                                <td>{court.additionalGuests}</td>
                                <td>{court.addedOn}</td>
                                <td className="text-pink view-detail-pink">
                                  <Link to={`/venue-details?id=${court.id}`}>
                                    <i className="feather-eye"></i> View Details
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
                                          <i className="feather-edit"></i> Edit
                                        </button>
                                      </li>
                                      <li>
                                        <button type="button" className="dropdown-item">
                                          <i className="feather-trash"></i> Delete
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

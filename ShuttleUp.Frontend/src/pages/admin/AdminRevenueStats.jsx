import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

// ── Mock data ──────────────────────────────────────────────────────────────
const revenueSummary = [
  { label: 'Tổng doanh thu',        value: '248.600.000 ₫', color: 'primary', icon: 'invoice-icon.svg' },
  { label: 'Doanh thu tháng này',   value: '38.400.000 ₫',  color: 'success', icon: 'invoice-icon.svg' },
  { label: 'Doanh thu hôm nay',     value: '2.720.000 ₫',   color: 'warning', icon: 'invoice-icon.svg' },
  { label: 'Số sân đang hoạt động', value: '87',             color: 'info',    icon: 'court-icon.svg'   },
];

const venueRevenue = [
  { id: 1, venue: 'ShuttleUp Quận 7',       owner: 'Trần Phúc Hùng',  totalBookings: 312, revenue: '74.880.000 ₫',  growth: '+12%'  },
  { id: 2, venue: 'ShuttleUp Bình Thạnh',   owner: 'Đặng Quốc Huy',   totalBookings: 198, revenue: '47.520.000 ₫',  growth: '+8%'   },
  { id: 3, venue: 'Cầu lông Gò Vấp',        owner: 'Bùi Xuân Mạnh',   totalBookings: 254, revenue: '60.960.000 ₫',  growth: '+15%'  },
  { id: 4, venue: 'ShuttleUp Tân Bình',     owner: 'Võ Thành Long',    totalBookings: 176, revenue: '35.200.000 ₫',  growth: '+5%'   },
  { id: 5, venue: 'Arena Badminton Q.3',    owner: 'Ngô Sỹ Duy',       totalBookings: 130, revenue: '30.040.000 ₫',  growth: '-2%'   },
];

export default function AdminRevenueStats() {
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Thống kê Doanh thu</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/admin/dashboard">Quản trị</Link></li>
            <li>Thống kê Doanh thu</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Revenue Summary Cards ─────────────────────── */}
          <div className="row mb-4">
            {revenueSummary.map((s) => (
              <div key={s.label} className="col-xl-3 col-sm-6 col-12 d-flex">
                <div className="card w-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>{s.label}</p>
                        <h5 className={`mb-0 text-${s.color}`}>{s.value}</h5>
                      </div>
                      <div className={`rounded-circle bg-${s.color} bg-opacity-10 p-2`}>
                        <img src={`/assets/img/icons/${s.icon}`} alt="" style={{ width: 28 }} />
                      </div>
                    </div>
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
                    {venueRevenue.map((v, idx) => (
                      <tr key={v.id}>
                        <td className="text-muted">{idx + 1}</td>
                        <td><strong>{v.venue}</strong></td>
                        <td>{v.owner}</td>
                        <td>{v.totalBookings.toLocaleString()} lượt</td>
                        <td><strong className="text-success">{v.revenue}</strong></td>
                        <td>
                          <span className={`badge ${v.growth.startsWith('+') ? 'bg-success' : 'bg-danger'}`}>
                            {v.growth}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-light fw-bold">
                      <td colSpan={3}>Tổng cộng</td>
                      <td>{venueRevenue.reduce((a, v) => a + v.totalBookings, 0).toLocaleString()} lượt</td>
                      <td className="text-success">248.600.000 ₫</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

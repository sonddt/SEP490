import { useState } from 'react';
import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const mockTransactions = [
  { id: 1, refId: 'TXN-001', name: 'Nguyễn Văn A', img: '/assets/img/profiles/user-01.jpg', dateTime: '12/03/2026 10:15', amount: 240000, type: 'credit', status: 'PAID' },
  { id: 2, refId: 'TXN-002', name: 'Trần Thị B',   img: '/assets/img/profiles/user-02.jpg', dateTime: '12/03/2026 08:30', amount: 240000, type: 'credit', status: 'PAID' },
  { id: 3, refId: 'TXN-003', name: 'Phí nền tảng', img: '/assets/img/icons/invoice-icon.svg', dateTime: '01/03/2026 00:00', amount: 50000, type: 'debit', status: 'PAID' },
  { id: 4, refId: 'TXN-004', name: 'Lê Văn C',     img: '/assets/img/profiles/user-03.jpg', dateTime: '11/03/2026 16:45', amount: 320000, type: 'credit', status: 'PENDING' },
  { id: 5, refId: 'TXN-005', name: 'Hoàng Văn E',  img: '/assets/img/profiles/user-04.jpg', dateTime: '10/03/2026 07:00', amount: 240000, type: 'credit', status: 'PAID' },
];

const statusBadge = {
  PAID:    <span className="badge bg-success">Đã thanh toán</span>,
  PENDING: <span className="badge bg-warning text-dark">Chờ xử lý</span>,
  FAILED:  <span className="badge bg-danger">Thất bại</span>,
};

const PRESET_AMOUNTS = [100000, 200000, 500000, 1000000];

export default function ManagerWallet() {
  const [filter, setFilter]   = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('week');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [payMethod, setPayMethod] = useState('card');

  const balance     = 4544000;
  const totalCredit = 12400000;
  const totalDebit  = 50000;
  const totalTxn    = mockTransactions.length;

  const filtered = mockTransactions.filter((t) =>
    filter === 'ALL' || t.status === filter
  );

  const handleAddPayment = (e) => {
    e.preventDefault();
    alert(`Nạp tiền thành công: ${Number(addAmount).toLocaleString('vi-VN')} ₫ qua ${payMethod}`);
    setShowAddModal(false);
    setAddAmount('');
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Ví của tôi</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/dashboard">Quản lý sân</Link></li>
            <li>Ví</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          <div className="row mb-4">

            {/* ── Wallet Balance ──────────────────────────── */}
            <div className="col-lg-6 d-flex">
              <div className="card w-100">
                <div className="card-body">
                  <h5 className="mb-3">Số dư ví</h5>
                  <h2 className="text-primary mb-4">{balance.toLocaleString('vi-VN')} ₫</h2>
                  <div className="row text-center mb-4">
                    <div className="col-4">
                      <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Tổng thu</p>
                      <strong className="text-success">{totalCredit.toLocaleString('vi-VN')} ₫</strong>
                    </div>
                    <div className="col-4">
                      <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Tổng chi</p>
                      <strong className="text-danger">{totalDebit.toLocaleString('vi-VN')} ₫</strong>
                    </div>
                    <div className="col-4">
                      <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Giao dịch</p>
                      <strong>{totalTxn}</strong>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary flex-fill" onClick={() => setShowAddModal(true)}>
                      <i className="feather-plus-circle me-2"></i>Nạp tiền
                    </button>
                    <button className="btn btn-outline-secondary flex-fill" onClick={() => setShowTransferModal(true)}>
                      <i className="feather-send me-2"></i>Rút tiền
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bank / Card ─────────────────────────────── */}
            <div className="col-lg-6 d-flex">
              <div className="card w-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Phương thức thanh toán</h5>
                    <button className="btn btn-sm btn-outline-secondary">
                      <i className="feather-plus me-1"></i>Thêm thẻ
                    </button>
                  </div>
                  {/* Sample card */}
                  <div className="p-3 rounded text-white mb-3" style={{ background: 'linear-gradient(135deg, #1a1f6e, #2e3fad)', position: 'relative', minHeight: 130 }}>
                    <div className="d-flex justify-content-between mb-3">
                      <small>ShuttleUp Wallet</small>
                      <img src="/assets/img/icons/visa.svg" alt="Visa" style={{ height: 20 }} />
                    </div>
                    <div style={{ letterSpacing: 4, fontSize: '1.1rem' }}>•••• •••• •••• 4321</div>
                    <div className="d-flex justify-content-between mt-3">
                      <small>Tên chủ tài khoản</small>
                      <small>HH / MM</small>
                    </div>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                    <i className="feather-shield me-1 text-success"></i>
                    Thông tin thẻ được bảo mật theo tiêu chuẩn PCI DSS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Transactions Table ───────────────────────── */}
          <div className="card card-tableset">
            <div className="card-body">
              <div className="coache-head-blk mb-3">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <h4 className="mb-1">Lịch sử giao dịch</h4>
                  </div>
                  <div className="col-md-6 d-flex gap-2 justify-content-md-end mt-2 mt-md-0 flex-wrap">
                    <select
                      className="form-control form-control-sm" style={{ width: 'auto' }}
                      value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}
                    >
                      <option value="week">Tuần này</option>
                      <option value="month">Tháng này</option>
                      <option value="year">Năm này</option>
                    </select>
                    <select
                      className="form-control form-control-sm" style={{ width: 'auto' }}
                      value={filter} onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả giao dịch</option>
                      <option value="PAID">Thành công</option>
                      <option value="PENDING">Đang xử lý</option>
                      <option value="FAILED">Thất bại</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-borderless datatable">
                  <thead className="thead-light">
                    <tr>
                      <th>Mã GD</th>
                      <th>Nội dung</th>
                      <th>Ngày &amp; Giờ</th>
                      <th>Số tiền</th>
                      <th>Loại</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td><span className="text-primary fw-semibold">{t.refId}</span></td>
                        <td>
                          <h2 className="table-avatar">
                            <span className="avatar avatar-sm flex-shrink-0">
                              <img className="avatar-img rounded-circle" src={t.img} alt="" />
                            </span>
                            <span className="ms-2">{t.name}</span>
                          </h2>
                        </td>
                        <td>{t.dateTime}</td>
                        <td>
                          <strong className={t.type === 'credit' ? 'text-success' : 'text-danger'}>
                            {t.type === 'credit' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')} ₫
                          </strong>
                        </td>
                        <td>
                          {t.type === 'credit'
                            ? <span className="badge bg-success bg-opacity-10 text-success">Thu tiền</span>
                            : <span className="badge bg-danger bg-opacity-10 text-danger">Chi phí</span>
                          }
                        </td>
                        <td>{statusBadge[t.status]}</td>
                        <td>
                          <button type="button" className="btn btn-sm btn-link text-danger p-0">
                            <i className="feather-trash-2"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted py-4">Không có giao dịch nào</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Add Payment Modal ────────────────────────────── */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nạp tiền vào ví</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleAddPayment}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Số tiền nạp (₫)</label>
                    <input
                      type="number" className="form-control" min={10000}
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="Nhập số tiền"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Chọn nhanh</label>
                    <div className="d-flex flex-wrap gap-2">
                      {PRESET_AMOUNTS.map((a) => (
                        <button
                          key={a} type="button"
                          className={`btn btn-sm ${addAmount == a ? 'btn-secondary' : 'btn-outline-secondary'}`}
                          onClick={() => setAddAmount(String(a))}
                        >
                          +{a.toLocaleString('vi-VN')} ₫
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Phương thức thanh toán</label>
                    {[['card','Thẻ ngân hàng'],['momo','MoMo'],['banking','Chuyển khoản']].map(([val, label]) => (
                      <div key={val} className="form-check">
                        <input
                          className="form-check-input" type="radio"
                          id={`pay-${val}`} name="payMethod" value={val}
                          checked={payMethod === val}
                          onChange={() => setPayMethod(val)}
                        />
                        <label className="form-check-label" htmlFor={`pay-${val}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddModal(false)}>Huỷ</button>
                  <button type="submit" className="btn btn-secondary">Nạp tiền</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer / Withdraw Modal ───────────────────── */}
      {showTransferModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Rút tiền</h5>
                <button type="button" className="btn-close" onClick={() => setShowTransferModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Số tiền rút (₫)</label>
                  <input type="number" className="form-control" min={50000} placeholder="Nhập số tiền" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Số tài khoản ngân hàng</label>
                  <input type="text" className="form-control" placeholder="Số tài khoản thụ hưởng" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Ngân hàng</label>
                  <select className="form-control">
                    <option>Vietcombank</option>
                    <option>BIDV</option>
                    <option>Techcombank</option>
                    <option>MB Bank</option>
                    <option>Agribank</option>
                    <option>ACB</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowTransferModal(false)}>Huỷ</button>
                <button type="button" className="btn btn-secondary" onClick={() => { alert('Yêu cầu rút tiền đã được gửi!'); setShowTransferModal(false); }}>Xác nhận rút tiền</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

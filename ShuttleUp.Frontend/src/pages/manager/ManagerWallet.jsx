import { useState } from 'react';

const mockTransactions = [
  { id: 1, refId: 'TXN-001', name: 'Nguyễn Văn A', img: '/assets/img/profiles/avatar-01.jpg', dateTime: '12/03/2026 10:15', amount: 240000, type: 'credit', status: 'PAID' },
  { id: 2, refId: 'TXN-002', name: 'Trần Thị B',   img: '/assets/img/profiles/avatar-02.jpg', dateTime: '12/03/2026 08:30', amount: 240000, type: 'credit', status: 'PAID' },
  { id: 3, refId: 'TXN-003', name: 'Phí nền tảng', img: '/assets/img/icons/invoice-icon.svg', dateTime: '01/03/2026 00:00', amount: 50000,  type: 'debit',  status: 'PAID' },
  { id: 4, refId: 'TXN-004', name: 'Lê Văn C',     img: '/assets/img/profiles/avatar-03.jpg', dateTime: '11/03/2026 16:45', amount: 320000, type: 'credit', status: 'PENDING' },
  { id: 5, refId: 'TXN-005', name: 'Hoàng Văn E',  img: '/assets/img/profiles/avatar-04.jpg', dateTime: '10/03/2026 07:00', amount: 240000, type: 'credit', status: 'PAID' },
];

const STATUS_MAP = {
  PAID:    { label: 'Thành công', color: '#097E52', bg: '#e8f5ee' },
  PENDING: { label: 'Đang xử lý', color: '#d97706', bg: '#fef3c7' },
  FAILED:  { label: 'Thất bại',   color: '#ef4444', bg: '#fff1f2' },
};

const PRESET_AMOUNTS = [100000, 200000, 500000, 1000000];

const walletStats = [
  { label: 'Số dư hiện tại', value: '4.544.000 ₫', icon: 'feather-credit-card', color: '#097E52', bg: '#e8f5ee' },
  { label: 'Tổng thu',        value: '12.400.000 ₫', icon: 'feather-trending-up', color: '#2563eb', bg: '#eff6ff' },
  { label: 'Tổng chi',        value: '50.000 ₫',     icon: 'feather-trending-down', color: '#ef4444', bg: '#fef2f2' },
  { label: 'Giao dịch',       value: String(mockTransactions.length), icon: 'feather-list', color: '#d97706', bg: '#fffbeb' },
];

export default function ManagerWallet() {
  const [filter, setFilter]               = useState('ALL');
  const [timeFilter, setTimeFilter]       = useState('month');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showTransfer, setShowTransfer]   = useState(false);
  const [addAmount, setAddAmount]         = useState('');
  const [payMethod, setPayMethod]         = useState('card');

  const filtered = mockTransactions.filter((t) => filter === 'ALL' || t.status === filter);

  const handleAddPayment = (e) => {
    e.preventDefault();
    alert(`Nạp tiền thành công: ${Number(addAmount).toLocaleString('vi-VN')} ₫ qua ${payMethod}`);
    setShowAddModal(false);
    setAddAmount('');
  };

  return (
    <>
      {/* ── Stats ────────────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {walletStats.map((s) => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="mgr-stat-card">
              <div className="mgr-stat-card__icon" style={{ background: s.bg }}>
                <i className={s.icon} style={{ color: s.color }} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Credit card display ──────────────────────────── */}
      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card border-0 bk-table-card h-100">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Ví của tôi</h4>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, #064e3b, #097E52)', borderRadius: 16, padding: '24px 24px', color: '#fff', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', bottom: -30, left: -10, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>Số dư khả dụng</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>4.544.000 ₫</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: .8 }}>
                  <span>ShuttleUp Manager Wallet</span>
                  <span>Cập nhật hôm nay</span>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-secondary flex-fill" onClick={() => setShowAddModal(true)}>
                  <i className="feather-plus-circle me-2" />Nạp tiền
                </button>
                <button className="btn btn-outline-secondary flex-fill" onClick={() => setShowTransfer(true)}>
                  <i className="feather-send me-2" />Rút tiền
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 bk-table-card h-100">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Phương thức thanh toán đã lưu</h4>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: 'linear-gradient(135deg, #1a1f6e, #2e3fad)', borderRadius: 14, padding: '20px 22px', color: '#fff', marginBottom: 16, minHeight: 110 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <small>Thẻ ngân hàng</small>
                  <i className="feather-credit-card" style={{ fontSize: 20 }} />
                </div>
                <div style={{ letterSpacing: 4, fontSize: '1rem', marginBottom: 12 }}>•••• •••• •••• 4321</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: .8 }}>
                  <small>Tên chủ tài khoản</small>
                  <small>HH / MM</small>
                </div>
              </div>
              <button className="btn btn-outline-secondary btn-sm w-100">
                <i className="feather-plus me-1" />Thêm phương thức
              </button>
              <p className="text-muted mt-2 mb-0" style={{ fontSize: '.8rem' }}>
                <i className="feather-shield me-1 text-success" />
                Thông tin được bảo mật theo tiêu chuẩn PCI DSS.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transactions Table ──────────────────────────── */}
      <div className="card border-0 bk-table-card">
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Lịch sử giao dịch</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{filtered.length} giao dịch</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bk-filters-row">
          <select className="form-select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="year">Năm này</option>
          </select>
          <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Tất cả giao dịch</option>
            <option value="PAID">Thành công</option>
            <option value="PENDING">Đang xử lý</option>
            <option value="FAILED">Thất bại</option>
          </select>
          <span className="bk-filter-count">{filtered.length}/{mockTransactions.length}</span>
        </div>

        {/* Desktop table */}
        <div className="bk-table-wrap">
          <table className="bk-table">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Nội dung</th>
                <th>Ngày &amp; Giờ</th>
                <th>Số tiền</th>
                <th>Loại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.PAID;
                return (
                  <tr key={t.id} className="bk-row">
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{t.refId}</span>
                    </td>
                    <td>
                      <div className="bk-cell-flex">
                        <img src={t.img} alt={t.name} className="bk-avatar"
                          onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                        <span className="bk-cell-primary">{t.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="bk-cell-primary">{t.dateTime}</span>
                    </td>
                    <td>
                      <strong className="bk-amount" style={{ color: t.type === 'credit' ? '#097E52' : '#ef4444' }}>
                        {t.type === 'credit' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')} ₫
                      </strong>
                    </td>
                    <td>
                      <span className="bk-badge" style={{
                        color: t.type === 'credit' ? '#097E52' : '#ef4444',
                        background: t.type === 'credit' ? '#e8f5ee' : '#fff1f2',
                        borderColor: t.type === 'credit' ? '#e8f5ee' : '#fff1f2',
                      }}>
                        {t.type === 'credit' ? 'Thu tiền' : 'Chi phí'}
                      </span>
                    </td>
                    <td>
                      <span className="bk-badge" style={{ color: st.color, background: st.bg, borderColor: st.bg }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="bk-empty">
                      <div className="bk-empty-icon"><i className="feather-inbox" /></div>
                      <p className="bk-empty-title">Không có giao dịch nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="bk-cards-wrap">
          {filtered.length === 0 ? (
            <div className="bk-empty">
              <div className="bk-empty-icon"><i className="feather-inbox" /></div>
              <p className="bk-empty-title">Không có giao dịch nào</p>
            </div>
          ) : (
            filtered.map((t) => {
              const st = STATUS_MAP[t.status] || STATUS_MAP.PAID;
              return (
                <div key={t.id} className="bk-mobile-card">
                  <div className="bk-mobile-card__header">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                      <img src={t.img} alt={t.name} className="rounded-circle"
                        style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }}
                        onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.refId}</div>
                      </div>
                    </div>
                    <span className="bk-badge" style={{ color: st.color, background: st.bg, borderColor: st.bg, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="bk-mobile-card__body">
                    <div className="bk-mobile-card__row">
                      <span className="bk-mobile-card__label"><i className="feather-calendar" />Thời gian</span>
                      <span style={{ fontSize: 13, color: '#1e293b' }}>{t.dateTime}</span>
                    </div>
                    <div className="bk-mobile-card__row">
                      <span className="bk-mobile-card__label"><i className="feather-dollar-sign" />Số tiền</span>
                      <strong style={{ fontSize: 15, color: t.type === 'credit' ? '#097E52' : '#ef4444' }}>
                        {t.type === 'credit' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')} ₫
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Nạp tiền Modal ──────────────────────────────── */}
      {showAddModal && (
        <div className="mgr-delete-modal" onClick={() => setShowAddModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Nạp tiền vào ví</h5>
            <form onSubmit={handleAddPayment}>
              <div className="mb-3">
                <label className="form-label">Số tiền nạp (₫)</label>
                <input type="number" className="form-control" min={10000}
                  value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Nhập số tiền" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Chọn nhanh</label>
                <div className="d-flex flex-wrap gap-2">
                  {PRESET_AMOUNTS.map((a) => (
                    <button key={a} type="button"
                      className={`btn btn-sm ${Number(addAmount) === a ? 'btn-secondary' : 'btn-outline-secondary'}`}
                      onClick={() => setAddAmount(String(a))}>
                      +{a.toLocaleString('vi-VN')} ₫
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Phương thức thanh toán</label>
                {[['card','Thẻ ngân hàng'],['momo','MoMo'],['banking','Chuyển khoản']].map(([val, label]) => (
                  <div key={val} className="form-check">
                    <input className="form-check-input" type="radio" id={`pay-${val}`}
                      name="payMethod" value={val} checked={payMethod === val}
                      onChange={() => setPayMethod(val)} />
                    <label className="form-check-label" htmlFor={`pay-${val}`}>{label}</label>
                  </div>
                ))}
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setShowAddModal(false)}>Huỷ</button>
                <button type="submit" className="btn btn-secondary flex-fill">Nạp tiền</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rút tiền Modal ──────────────────────────────── */}
      {showTransfer && (
        <div className="mgr-delete-modal" onClick={() => setShowTransfer(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <h5 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Rút tiền</h5>
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
              <select className="form-select">
                {['Vietcombank','BIDV','Techcombank','MB Bank','Agribank','ACB'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setShowTransfer(false)}>Huỷ</button>
              <button type="button" className="btn btn-secondary flex-fill"
                onClick={() => { alert('Yêu cầu rút tiền đã được gửi!'); setShowTransfer(false); }}>
                Xác nhận rút tiền
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

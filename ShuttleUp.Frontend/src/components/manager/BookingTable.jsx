import { BOOKING_STATUSES, PAYMENT_METHODS } from '../../data/bookingsMock';

/* ── Status Badge ─────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const st = BOOKING_STATUSES[status] || BOOKING_STATUSES.PENDING;
  return (
    <span className="bk-badge" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
      <i className={st.icon} />
      {st.label}
    </span>
  );
}

/* ── Action Buttons (icon-only with tooltip) ──────────────────────────── */
function ActionButtons({ booking, onView, onAccept, onReject, onCancel }) {
  const { id, status } = booking;
  return (
    <div className="bk-actions">
      <button type="button" className="bk-act bk-act--view" onClick={() => onView(booking)} title="Xem chi tiết">
        <i className="feather-eye" />
      </button>
      {status === 'PENDING' && (
        <>
          <button type="button" className="bk-act bk-act--accept" onClick={() => onAccept(id)} title="Duyệt">
            <i className="feather-check" />
          </button>
          <button type="button" className="bk-act bk-act--reject" onClick={() => onReject(booking)} title="Từ chối">
            <i className="feather-x" />
          </button>
        </>
      )}
      {status === 'UPCOMING' && (
        <button type="button" className="bk-act bk-act--cancel" onClick={() => onCancel(id)} title="Huỷ">
          <i className="feather-slash" />
        </button>
      )}
    </div>
  );
}

/* ── Desktop Table Row ────────────────────────────────────────────────── */
function BookingRow({ booking, onView, onAccept, onReject, onCancel }) {
  const { player, playerImg, court, courtImg, venue, dateDisplay, timeStart, timeEnd,
    amount, paymentMethod, paymentStatus, status } = booking;
  const pm = PAYMENT_METHODS[paymentMethod] || PAYMENT_METHODS.CASH;
  const psLabel = paymentStatus === 'PAID' ? 'Đã TT' : paymentStatus === 'REFUNDED' ? 'Hoàn tiền' : 'Chưa TT';
  const psColor = paymentStatus === 'PAID' ? '#097E52' : paymentStatus === 'REFUNDED' ? '#f59e0b' : '#94a3b8';

  return (
    <tr className="bk-row">
      <td>
        <div className="bk-cell-flex">
          <div className="bk-thumb-wrap">
            <img src={courtImg} alt="" className="bk-thumb"
              onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
          </div>
          <div className="bk-cell-text">
            <span className="bk-cell-primary">{court}</span>
            <span className="bk-cell-secondary"><i className="feather-map-pin" />{venue}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="bk-cell-flex">
          <img src={playerImg} alt={player} className="bk-avatar"
            onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
          <span className="bk-cell-primary">{player}</span>
        </div>
      </td>
      <td>
        <div className="bk-cell-text">
          <span className="bk-cell-primary"><i className="feather-calendar bk-cell-icon" />{dateDisplay}</span>
          <span className="bk-cell-secondary"><i className="feather-clock bk-cell-icon" />{timeStart} – {timeEnd}</span>
        </div>
      </td>
      <td>
        <strong className="bk-amount">{amount.toLocaleString('vi-VN')} ₫</strong>
        <div className="bk-cell-secondary" style={{ marginTop: 2 }}>
          <i className={pm.icon} style={{ fontSize: 12, marginRight: 3 }} />
          <span style={{ color: psColor, fontWeight: 600 }}>{psLabel}</span>
        </div>
      </td>
      <td><StatusBadge status={status} /></td>
      <td>
        <ActionButtons booking={booking} onView={onView} onAccept={onAccept} onReject={onReject} onCancel={onCancel} />
      </td>
    </tr>
  );
}

/* ── Desktop Skeleton Row ─────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[140, 100, 110, 60, 80].map((w, i) => (
        <td key={i}><div className="bk-skeleton" style={{ width: w, height: 14, borderRadius: 4 }} /></td>
      ))}
      <td><div className="bk-skeleton" style={{ width: 56, height: 28, borderRadius: 6 }} /></td>
    </tr>
  );
}

/* ── Mobile Skeleton Card ─────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bk-mobile-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div className="bk-skeleton" style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="bk-skeleton" style={{ height: 14, borderRadius: 4, marginBottom: 6 }} />
          <div className="bk-skeleton" style={{ height: 11, borderRadius: 4, width: '60%' }} />
        </div>
      </div>
      <div className="bk-skeleton" style={{ height: 11, borderRadius: 4, marginBottom: 8 }} />
      <div className="bk-skeleton" style={{ height: 11, borderRadius: 4, width: '70%' }} />
    </div>
  );
}

/* ── Mobile Card ──────────────────────────────────────────────────────── */
function BookingCard({ booking, onView, onAccept, onReject, onCancel }) {
  const { player, playerImg, court, courtImg, venue, dateDisplay, timeStart, timeEnd,
    amount, paymentMethod, paymentStatus, status } = booking;
  const pm = PAYMENT_METHODS[paymentMethod] || PAYMENT_METHODS.CASH;
  const st = BOOKING_STATUSES[status] || BOOKING_STATUSES.PENDING;
  const paidLabel = paymentStatus === 'PAID' ? 'Đã thanh toán' : paymentStatus === 'REFUNDED' ? 'Hoàn tiền' : 'Chưa TT';
  const paidColor = paymentStatus === 'PAID' ? '#097E52' : paymentStatus === 'REFUNDED' ? '#f59e0b' : '#94a3b8';

  return (
    <div className="bk-mobile-card">
      <div className="bk-mobile-card__header">
        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src={courtImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{court}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="feather-map-pin" style={{ fontSize: 11 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue}</span>
            </div>
          </div>
        </div>
        <span className="bk-badge" style={{ color: st.color, background: st.bg, borderColor: st.border, flexShrink: 0 }}>
          <i className={st.icon} />{st.label}
        </span>
      </div>
      <div className="bk-mobile-card__body">
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-user" />Người đặt</span>
          <div className="d-flex align-items-center gap-2">
            <img src={playerImg} alt="" className="rounded-circle"
              style={{ width: 22, height: 22, objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>{player}</span>
          </div>
        </div>
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-calendar" />Thời gian</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{dateDisplay}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{timeStart} – {timeEnd}</div>
          </div>
        </div>
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-credit-card" />Thanh toán</span>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: 15, color: '#097E52', display: 'block' }}>
              {amount.toLocaleString('vi-VN')} ₫
            </strong>
            <span style={{ fontSize: 12, color: paidColor, fontWeight: 600 }}>
              <i className={pm.icon} style={{ marginRight: 3 }} />{paidLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="bk-mobile-card__actions">
        <button type="button" className="bk-btn bk-btn-view" style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => onView(booking)} title="Xem chi tiết">
          <i className="feather-eye" /><span>Chi tiết</span>
        </button>
        {status === 'PENDING' && (
          <>
            <button type="button" className="bk-btn bk-btn-accept" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => onAccept(booking.id)} title="Duyệt">
              <i className="feather-check" /><span>Duyệt</span>
            </button>
            <button type="button" className="bk-btn bk-btn-reject" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => onReject(booking)} title="Từ chối">
              <i className="feather-x" /><span>Từ chối</span>
            </button>
          </>
        )}
        {status === 'UPCOMING' && (
          <button type="button" className="bk-btn bk-btn-cancel" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onCancel(booking.id)} title="Huỷ">
            <i className="feather-slash" /><span>Huỷ</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────── */
function EmptyState({ search, mobile = false }) {
  const content = (
    <div className="bk-empty">
      <div className="bk-empty-icon">
        <i className={search ? 'feather-search' : 'feather-inbox'} />
      </div>
      <p className="bk-empty-title">
        {search ? `Không tìm thấy kết quả cho "${search}"` : 'Không có đặt sân nào'}
      </p>
      <p className="bk-empty-sub">
        {search ? 'Thử tìm kiếm với từ khoá khác' : 'Các đặt sân mới sẽ xuất hiện tại đây'}
      </p>
    </div>
  );
  if (mobile) return content;
  return <tr><td colSpan={6}>{content}</td></tr>;
}

/* ── Main Export ──────────────────────────────────────────────────────── */
export default function BookingTable({ bookings, loading, search, onView, onAccept, onReject, onCancel }) {
  return (
    <>
      {/* Desktop / Tablet — real HTML table */}
      <div className="bk-table-wrap">
        <table className="bk-table">
          <colgroup>
            <col className="bk-col-court" />
            <col className="bk-col-player" />
            <col className="bk-col-datetime" />
            <col className="bk-col-amount" />
            <col className="bk-col-status" />
            <col className="bk-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Sân / Cụm sân</th>
              <th>Người đặt</th>
              <th>Ngày &amp; Giờ</th>
              <th>Tiền</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : bookings.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              bookings.map((b) => (
                <BookingRow key={b.id} booking={b}
                  onView={onView} onAccept={onAccept}
                  onReject={onReject} onCancel={onCancel} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="bk-cards-wrap">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : bookings.length === 0 ? (
          <EmptyState search={search} mobile />
        ) : (
          bookings.map((b) => (
            <BookingCard key={b.id} booking={b}
              onView={onView} onAccept={onAccept}
              onReject={onReject} onCancel={onCancel} />
          ))
        )}
      </div>
    </>
  );
}

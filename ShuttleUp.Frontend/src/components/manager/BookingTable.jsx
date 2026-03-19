import { BOOKING_STATUSES, PAYMENT_METHODS } from '../../data/bookingsMock';

/* ── Status Badge ─────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const st = BOOKING_STATUSES[status] || BOOKING_STATUSES.PENDING;
  return (
    <span
      className="bk-status-badge"
      style={{ color: st.color, background: st.bg, borderColor: st.border }}
    >
      <i className={st.icon} />
      {st.label}
    </span>
  );
}

/* ── Payment Badge ────────────────────────────────────────────────── */
function PaymentBadge({ method, paymentStatus }) {
  const pm = PAYMENT_METHODS[method] || PAYMENT_METHODS.CASH;
  const paidColor = paymentStatus === 'PAID' ? '#097E52' : paymentStatus === 'REFUNDED' ? '#f59e0b' : '#94a3b8';
  const paidLabel = paymentStatus === 'PAID' ? 'Đã TT' : paymentStatus === 'REFUNDED' ? 'Hoàn tiền' : 'Chưa TT';
  return (
    <div className="d-flex flex-column gap-1">
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
        <i className={pm.icon} style={{ fontSize: 12, marginRight: 4, color: '#64748b' }} />
        {pm.label}
      </span>
      <span style={{ fontSize: 11, color: paidColor, fontWeight: 600 }}>{paidLabel}</span>
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[80, 120, 90, 80, 80, 100, 90].map((w, i) => (
        <td key={i}>
          <div className="bk-skeleton" style={{ width: w, height: 16, borderRadius: 4 }} />
        </td>
      ))}
      <td>
        <div className="bk-skeleton" style={{ width: 88, height: 28, borderRadius: 6 }} />
      </td>
    </tr>
  );
}

/* ── Single booking row ───────────────────────────────────────────── */
function BookingRow({ booking, onView, onAccept, onReject, onCancel }) {
  const { id, player, playerImg, court, courtImg, venue, dateDisplay, timeStart, timeEnd,
    amount, paymentMethod, paymentStatus, status } = booking;

  return (
    <tr className="bk-row">
      {/* Court */}
      <td>
        <div className="d-flex align-items-center gap-2">
          <div className="bk-thumb-wrap">
            <img src={courtImg} alt="" className="bk-thumb" />
          </div>
          <div className="bk-court-info">
            <span className="bk-court-name">{court}</span>
            <span className="bk-venue-name">
              <i className="feather-map-pin" style={{ fontSize: 10, marginRight: 2 }} />
              {venue}
            </span>
          </div>
        </div>
      </td>

      {/* Player */}
      <td>
        <div className="d-flex align-items-center gap-2">
          <img
            src={playerImg}
            alt={player}
            className="rounded-circle bk-avatar"
            onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }}
          />
          <span className="bk-player-name">{player}</span>
        </div>
      </td>

      {/* Date & Time */}
      <td>
        <div className="bk-datetime">
          <span className="bk-date">
            <i className="feather-calendar" />
            {dateDisplay}
          </span>
          <span className="bk-time">
            <i className="feather-clock" />
            {timeStart} – {timeEnd}
          </span>
        </div>
      </td>

      {/* Amount */}
      <td>
        <strong className="bk-amount">{amount.toLocaleString('vi-VN')} ₫</strong>
      </td>

      {/* Payment */}
      <td>
        <PaymentBadge method={paymentMethod} paymentStatus={paymentStatus} />
      </td>

      {/* Status */}
      <td><StatusBadge status={status} /></td>

      {/* Actions */}
      <td className="text-end">
        <div className="bk-actions">
          <button
            type="button"
            className="bk-btn bk-btn-view"
            onClick={() => onView(booking)}
            title="Xem chi tiết"
          >
            <i className="feather-eye" />
            <span>Chi tiết</span>
          </button>

          {status === 'PENDING' && (
            <>
              <button
                type="button"
                className="bk-btn bk-btn-accept"
                onClick={() => onAccept(id)}
                title="Chấp nhận"
              >
                <i className="feather-check" />
                <span>Duyệt</span>
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-reject"
                onClick={() => onReject(booking)}
                title="Từ chối"
              >
                <i className="feather-x" />
                <span>Từ chối</span>
              </button>
            </>
          )}

          {status === 'UPCOMING' && (
            <button
              type="button"
              className="bk-btn bk-btn-cancel"
              onClick={() => onCancel(id)}
              title="Huỷ"
            >
              <i className="feather-slash" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ search }) {
  return (
    <tr>
      <td colSpan={8}>
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
      </td>
    </tr>
  );
}

/* ── Main Table ───────────────────────────────────────────────────── */
export default function BookingTable({ bookings, loading, search, onView, onAccept, onReject, onCancel }) {
  return (
    <div className="card border-0 shadow-sm bk-table-card">
      <div className="table-responsive">
        <table className="table bk-table align-middle mb-0">
          <thead>
            <tr>
              <th>Sân / Cụm sân</th>
              <th>Người đặt</th>
              <th>Ngày &amp; Giờ</th>
              <th>Thanh toán</th>
              <th>Hình thức</th>
              <th>Trạng thái</th>
              <th className="text-end">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : bookings.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              bookings.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  onView={onView}
                  onAccept={onAccept}
                  onReject={onReject}
                  onCancel={onCancel}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';

// ── Mini Calendar Popup ────────────────────────────────────────────────────
function CalendarPopup({ value, onChange, onClose }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [tempDate, setTempDate] = useState(value);

  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  // Convert to Mon-based (Mon=0 ... Sun=6)
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const monthNames = ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6','tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'];

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toIso = (d) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  const todayIso = today.toISOString().split('T')[0];

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
          minWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-sm btn-link text-dark p-0 fs-5" onClick={prevMonth}>&#8249;</button>
          <span className="fw-semibold">{monthNames[viewMonth]} năm {viewYear}</span>
          <button className="btn btn-sm btn-link text-dark p-0 fs-5" onClick={nextMonth}>&#8250;</button>
        </div>

        {/* Day headers */}
        <div className="d-grid mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)', display: 'grid' }}>
          {DAYS.map(d => (
            <div key={d} className="text-center text-muted" style={{ fontSize: '12px', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Date cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const iso = toIso(d);
            const isSelected = iso === tempDate;
            const isToday = iso === todayIso;
            const isPast = iso < todayIso;
            return (
              <button
                key={i}
                disabled={isPast}
                onClick={() => !isPast && setTempDate(iso)}
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  margin: '1px auto',
                  display: 'block',
                  fontSize: '14px',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  backgroundColor: isSelected ? '#16a34a' : isToday ? '#dcfce7' : 'transparent',
                  color: isSelected ? '#fff' : isPast ? '#ccc' : '#111',
                  fontWeight: isToday ? '700' : '400',
                }}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="d-flex justify-content-end gap-3 mt-4">
          <button className="btn btn-link text-muted text-decoration-none" onClick={onClose}>Huỷ</button>
          <button
            className="btn text-white px-4"
            style={{ backgroundColor: '#16a34a', borderRadius: '8px' }}
            onClick={() => { onChange(tempDate); onClose(); }}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function slotToTime(index, startHour = 5) {
  const totalMins = startHour * 60 + index * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BookingTimeline() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCalendar, setShowCalendar] = useState(false);

  // selections: Map<courtId, Set<slotIndex>>
  const [selections, setSelections] = useState({});

  // Drag state per-court (each court tracks independently)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null); // { courtId, slotIndex }
  const [, forceUpdate] = useState(0);

  // ── Courts & time slots ──────────────────────────────────────────────────
  const courts = useMemo(() => [
    { id: 1, name: 'Sân 1', pricePerSlot: 100000 },
    { id: 2, name: 'Sân 2', pricePerSlot: 100000 },
    { id: 3, name: 'Sân 3', pricePerSlot: 100000 },
    { id: 4, name: 'Sân 4', pricePerSlot: 120000 },
  ], []);

  const START_HOUR = 5;
  const END_HOUR = 24;

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    slots.push('24:00');
    return slots;
  }, []);

  // ── Existing bookings (mock data) ────────────────────────────────────────
  const existingBookings = useMemo(() => [
    { courtId: 1, startIndex: 2,  endIndex: 6,  type: 'booked' },
    { courtId: 1, startIndex: 8,  endIndex: 11, type: 'booked' },
    { courtId: 2, startIndex: 24, endIndex: 34, type: 'booked' },
    { courtId: 3, startIndex: 30, endIndex: 36, type: 'booked' },
    { courtId: 4, startIndex: 9,  endIndex: 14, type: 'booked' },
    { courtId: 4, startIndex: 16, endIndex: 25, type: 'locked', label: '[Xé vé] - xé vé ngày trình 6t-1 năm: 0/8' },
    { courtId: 4, startIndex: 25, endIndex: 31, type: 'booked' },
  ], []);

  const getBookingAt = (courtId, slotIndex) =>
    existingBookings.find(b => b.courtId === courtId && slotIndex >= b.startIndex && slotIndex < b.endIndex);

  const isCellSelected = (courtId, slotIndex) =>
    !!(selections[courtId] && selections[courtId].has(slotIndex));

  const getCellStatus = (courtId, slotIndex) => {
    const booking = getBookingAt(courtId, slotIndex);
    if (booking) return { status: booking.type, label: booking.label, isBlockStart: slotIndex === booking.startIndex, booking };
    if (isCellSelected(courtId, slotIndex)) return { status: 'selected' };
    return { status: 'free' };
  };

  // ── Drag logic (per-court, multi-court allowed) ─────────────────────────
  const handleMouseDown = (courtId, slotIndex) => {
    const { status } = getCellStatus(courtId, slotIndex);
    if (status !== 'free' && status !== 'selected') return;

    isDraggingRef.current = true;
    dragStartRef.current = { courtId, slotIndex };

    setSelections(prev => {
      const next = { ...prev };
      // Toggle: if already selected this slot and it's a single-court click, deselect whole court
      if (status === 'selected' && next[courtId]?.has(slotIndex) && next[courtId].size === 1) {
        delete next[courtId];
        return next;
      }
      // Start new selection on this court (keep other courts)
      next[courtId] = new Set([slotIndex]);
      return next;
    });
  };

  const handleMouseEnter = (courtId, slotIndex) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    // Only extend drag within the same court
    if (courtId !== dragStartRef.current.courtId) return;

    const start = Math.min(dragStartRef.current.slotIndex, slotIndex);
    const end   = Math.max(dragStartRef.current.slotIndex, slotIndex);

    // Check conflict
    for (let i = start; i <= end; i++) {
      if (getBookingAt(courtId, i)) return;
    }

    const newSet = new Set();
    for (let i = start; i <= end; i++) newSet.add(i);
    setSelections(prev => ({ ...prev, [courtId]: newSet }));
  };

  // ── Global mouseup ───────────────────────────────────────────────────────
  useEffect(() => {
    const stop = () => {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      forceUpdate(n => n + 1);
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // ── Totals ───────────────────────────────────────────────────────────────
  const { totalSlots, totalPrice, totalHours } = useMemo(() => {
    let slots = 0;
    let price = 0;
    courts.forEach(c => {
      const count = selections[c.id]?.size ?? 0;
      slots += count;
      price += count * c.pricePerSlot;
    });
    const hours = slots * 0.5;
    const h = Math.floor(hours);
    const m = (hours - h) * 60;
    const label = m > 0 ? `${h}h${m}` : `${h}h`;
    return { totalSlots: slots, totalPrice: price, totalHours: label };
  }, [selections, courts]);

  // ── Cell color ───────────────────────────────────────────────────────────
  const getCellColor = (status) => {
    switch (status) {
      case 'booked':   return '#ef4444';
      case 'locked':   return '#c084fc';
      case 'selected': return '#16a34a';
      default:         return '#ffffff';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f0fdf4', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="d-flex justify-content-between align-items-center px-4 py-3"
        style={{ backgroundColor: '#0f766e' }}
      >
        <h5 className="mb-0 text-white fw-semibold">Đặt lịch ngày trực quan</h5>

        {/* Calendar trigger button */}
        <button
          onClick={() => setShowCalendar(true)}
          className="d-flex align-items-center gap-2 px-3 py-2 rounded"
          style={{
            backgroundColor: '#115e59', border: '1px solid #14b8a6',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
          }}
        >
          <i className="feather-calendar" style={{ fontSize: '16px' }}></i>
          {formatDateVN(selectedDate)}
        </button>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center flex-wrap gap-3 bg-white px-4 py-2 border-bottom">
        {[
          { color: '#ffffff', border: '#ccc', label: 'Trống' },
          { color: '#ef4444', label: 'Đã đặt' },
          { color: '#9ca3af', label: 'Khoá' },
          { color: '#c084fc', label: 'Sự kiện' },
          { color: '#16a34a', label: 'Đang chọn' },
        ].map(({ color, border, label }) => (
          <div key={label} className="d-flex align-items-center gap-1">
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px',
              backgroundColor: color,
              border: `1px solid ${border || color}`,
              flexShrink: 0
            }} />
            <span style={{ fontSize: '13px' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Notice ─────────────────────────────────────────────────────── */}
      <div className="text-center py-2" style={{ backgroundColor: '#fffbeb', color: '#92400e', fontSize: '13px' }}>
        Lưu ý: Cụm 4 sân đầy đủ hệ thống mái che bạt rút (nắng mưa đều chơi được)
      </div>

      {/* ── Timeline Grid ──────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', backgroundColor: '#fff', margin: '12px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ minWidth: `${80 + (timeSlots.length - 1) * 44}px` }}>

          {/* Time header row */}
          <div className="d-flex" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #d1fae5', position: 'sticky', top: 0, zIndex: 20 }}>
            <div style={{
              width: '72px', minWidth: '72px', position: 'sticky', left: 0,
              backgroundColor: '#f0fdf4', zIndex: 21, borderRight: '1px solid #d1fae5'
            }} />
            {timeSlots.slice(0, -1).map((slot, i) => (
              <div
                key={i}
                style={{
                  width: '44px', minWidth: '44px', textAlign: 'center',
                  fontSize: '11px', color: '#0369a1', padding: '6px 0',
                  borderRight: '1px solid #e0f2fe'
                }}
              >
                {slot}
              </div>
            ))}
          </div>

          {/* Court rows */}
          {courts.map(court => (
            <div
              key={court.id}
              className="d-flex"
              style={{ borderBottom: '1px solid #e5e7eb' }}
            >
              {/* Court name — sticky */}
              <div style={{
                width: '72px', minWidth: '72px', position: 'sticky', left: 0,
                backgroundColor: '#f8fafc', zIndex: 10,
                borderRight: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '600', color: '#374151'
              }}>
                {court.name}
              </div>

              {/* Time cells */}
              {timeSlots.slice(0, -1).map((slot, slotIdx) => {
                const { status, label, isBlockStart } = getCellStatus(court.id, slotIdx);
                const bg = getCellColor(status);
                const isClickable = status === 'free' || status === 'selected';

                return (
                  <div
                    key={slotIdx}
                    onMouseDown={() => handleMouseDown(court.id, slotIdx)}
                    onMouseEnter={() => handleMouseEnter(court.id, slotIdx)}
                    style={{
                      width: '44px', minWidth: '44px', height: '44px',
                      backgroundColor: bg,
                      borderRight: '1px solid #e5e7eb',
                      cursor: isClickable ? 'pointer' : 'not-allowed',
                      userSelect: 'none',
                      display: 'flex', alignItems: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                    title={isBlockStart && label ? label : undefined}
                  >
                    {isBlockStart && label && (
                      <span style={{
                        fontSize: '10px', color: '#fff', paddingLeft: '4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        position: 'absolute', left: 0, right: 0
                      }}>
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="fixed-bottom d-flex justify-content-between align-items-center px-4 py-3 border-top shadow"
        style={{ backgroundColor: '#fff', zIndex: 1000 }}
      >
        <div className="d-flex align-items-center gap-4">
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Tổng giờ: <strong style={{ color: '#111' }}>{totalSlots > 0 ? totalHours : '0h'}</strong>
          </span>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Tổng tiền: <strong style={{ color: '#16a34a', fontSize: '16px' }}>{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
          </span>
        </div>
        <button
          disabled={totalSlots === 0}
          className="btn fw-bold px-5 py-2"
          style={{
            backgroundColor: totalSlots > 0 ? '#eab308' : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            letterSpacing: '0.5px'
          }}
        >
          TIẾP THEO
        </button>
      </div>

      {/* ── Calendar Popup ─────────────────────────────────────────────── */}
      {showCalendar && (
        <CalendarPopup
          value={selectedDate}
          onChange={setSelectedDate}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}

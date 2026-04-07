import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { getVenueCourts, getVenueAvailability } from '../api/bookingApi';

// ── Mini Calendar Popup ────────────────────────────────────────────────────
function CalendarPopup({ value, onChange, onClose }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [tempDate, setTempDate] = useState(value);

  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthNames = [
    'tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6',
    'tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12',
  ];

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDay + 6) % 7; // Mon-based
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso    = today.toISOString().split('T')[0];

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const toIso = d => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px', minWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-sm btn-link text-dark p-0 fs-5" onClick={prevMonth}>&#8249;</button>
          <span className="fw-semibold">{monthNames[viewMonth]} năm {viewYear}</span>
          <button className="btn btn-sm btn-link text-dark p-0 fs-5" onClick={nextMonth}>&#8250;</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="mb-1">
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
            const isToday    = iso === todayIso;
            const isPast     = iso < todayIso;
            return (
              <button
                key={i}
                disabled={isPast}
                onClick={() => !isPast && setTempDate(iso)}
                style={{
                  border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                  margin: '1px auto', display: 'block', fontSize: '14px',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                  backgroundColor: isSelected ? '#16a34a' : isToday ? '#dcfce7' : 'transparent',
                  color: isSelected ? '#fff' : isPast ? '#ccc' : '#111',
                  fontWeight: isToday ? '700' : '400',
                }}
              >{d}</button>
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

const START_HOUR = 5;
const END_HOUR = 24;
/** Số ô 30 phút từ 5:00 đến trước 24:00 */
const SLOT_COUNT = (END_HOUR - START_HOUR) * 2;

function slotLocalBounds(dateStr, slotIndex) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const mins = START_HOUR * 60 + slotIndex * 30;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const start = new Date(y, m - 1, d, hh, mm, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
}

function isSameLocalDate(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  );
}

function parseApiTimeToMinutes(v) {
  if (v == null) return 0;
  const s = String(v);
  const parts = s.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const min = parseInt(parts[1], 10) || 0;
  return h * 60 + min;
}

function getPriceForSlot(court, slotIndex, dateStr, fallbackPerSlot) {
  const { start } = slotLocalBounds(dateStr, slotIndex);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const weekend = start.getDay() === 0 || start.getDay() === 6;
  const prices = court.prices || [];
  for (const p of prices) {
    if (!!p.isWeekend !== weekend) continue;
    const ps = parseApiTimeToMinutes(p.startTime);
    const pe = parseApiTimeToMinutes(p.endTime);
    if (minutes >= ps && minutes < pe) return Number(p.price) || 0;
  }
  if (prices.length) return Number(prices[0].price) || 0;
  return fallbackPerSlot ?? 0;
}

function ivOverlapsSlot(ivStartMs, ivEndMs, slotStartMs, slotEndMs) {
  return ivStartMs < slotEndMs && ivEndMs > slotStartMs;
}

/** @param {string} courtId */
/** ISO local (không Z) để backend/DB khớp ngày theo giờ máy người dùng */
function toLocalDateTimeString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}:${sec}`;
}

/** Giỏ: mỗi phần tử = một ngày + sân + danh sách chỉ số ô 30 phút */
function buildFlexibleApiItems(cart, courts, pricePerSlot) {
  const items = [];
  for (const entry of cart) {
    const { date, courtId, slotIndices } = entry;
    const court = courts.find(c => c.id === courtId);
    if (!court || !slotIndices?.length) continue;
    const sorted = [...new Set(slotIndices)].sort((a, b) => a - b);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
      const startIdx = sorted[i];
      const endIdx = sorted[j];
      const { start } = slotLocalBounds(date, startIdx);
      const { end } = slotLocalBounds(date, endIdx);
      items.push({
        courtId,
        startTime: toLocalDateTimeString(start),
        endTime: toLocalDateTimeString(end),
      });
      i = j + 1;
    }
  }
  return items;
}

function cartSlotCount(cart) {
  return cart.reduce((s, e) => s + (e.slotIndices?.length ?? 0), 0);
}

function cartTotalPrice(cart, courts, pricePerSlot) {
  let p = 0;
  for (const entry of cart) {
    const court = courts.find(c => c.id === entry.courtId);
    if (!court) continue;
    for (const idx of entry.slotIndices) {
      p += getPriceForSlot(court, idx, entry.date, pricePerSlot);
    }
  }
  return p;
}

const BLOCK_REASON_LABELS = {
  MAINTENANCE: 'Bảo trì',
  WEATHER: 'Thời tiết / môi trường',
  OTHER: 'Khác',
};

function labelForBlockedInterval(iv) {
  const detail = String(iv.reasonDetail ?? iv.ReasonDetail ?? '').trim();
  if (detail) return detail;
  const code = iv.reasonCode ?? iv.ReasonCode;
  if (code && BLOCK_REASON_LABELS[code]) return BLOCK_REASON_LABELS[code];
  return 'Khóa lịch';
}

function intervalsToGridBlocks(courtId, intervals, dateStr) {
  if (!intervals?.length) return [];
  const blocks = [];
  for (const iv of intervals) {
    const ivStart = new Date(iv.start).getTime();
    const ivEnd = new Date(iv.end).getTime();
    if (Number.isNaN(ivStart) || Number.isNaN(ivEnd)) continue;
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const { start, end } = slotLocalBounds(dateStr, i);
      if (ivOverlapsSlot(ivStart, ivEnd, start.getTime(), end.getTime())) {
        if (startIndex < 0) startIndex = i;
        endIndex = i + 1;
      }
    }
    if (startIndex >= 0) {
      const kind = iv.kind === 'blocked' ? 'locked' : 'booked';
      const label = iv.kind === 'blocked' ? labelForBlockedInterval(iv) : undefined;
      blocks.push({ courtId, startIndex, endIndex, type: kind, label });
    }
  }
  return blocks;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function LongTermFlexible() {
  const navigate = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  // Venue info passed from VenueDetails
  let venueState = location.state;
  if (!venueState) {
    try {
      const cached = sessionStorage.getItem('booking_venue_context');
      if (cached) venueState = JSON.parse(cached);
    } catch { }
  }
  venueState = venueState || {};
  const venueName    = venueState.venueName    ?? 'Chọn sân';
  const venueAddress = venueState.venueAddress ?? '';
  const venueId      = venueState.venueId      ?? null;
  const pricePerSlot = venueState.pricePerSlot ?? 100000;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCalendar, setShowCalendar]  = useState(false);

  // Ref to measure the grid container for computing the exact "fit" minimum
  const gridContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // cellWidth is the zoom level controlled by the slider
  // It's always clamped to >= minCellWidth so slider-at-min = no scroll
  const [cellWidth, setCellWidth] = useState(0); // 0 = uninitialized, will be set to minCellWidth on first measure

  // selections: { [courtId]: Set<slotIndex> }
  const [selections, setSelections] = useState({});
  /** @type {Array<{ date: string, courtId: string, courtName: string, slotIndices: number[] }>} */
  const [cart, setCart] = useState([]);

  const [courts, setCourts] = useState([]);
  const [availabilityRows, setAvailabilityRows] = useState([]);
  const [loadCourts, setLoadCourts] = useState({ loading: false, error: '' });
  const [loadAvail, setLoadAvail] = useState({ loading: false, error: '' });

  // Drag refs — distinguish click vs drag
  const isDraggingRef  = useRef(false);
  const hasDraggedRef  = useRef(false);
  const dragStartRef   = useRef(null); // { courtId, slotIndex }
  const dragModeRef    = useRef('add'); // add | remove
  // Snapshot of the court's selection BEFORE the current drag started
  // so new drag ranges ADD to existing selection rather than replace it
  const dragBaseRef    = useRef(new Set());

  // ── Responsive min cell width ────────────────────────────────────────────
  const COURT_LABEL_W = 72; // px reserved for court name column
  const MAX_CELL_W    = 56; // px maximum zoom

  // Measure container and derive minCellWidth dynamically
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const measure = (width) => {
      const slots = SLOT_COUNT;
      const minW = Math.max(10, Math.floor((width - COURT_LABEL_W) / slots));
      setContainerWidth(width);
      setCellWidth(prev => {
        // On first measure (prev===0) default to minW; otherwise preserve user zoom but re-clamp
        if (prev === 0) return minW;
        return Math.max(prev, minW);
      });
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Minimum cell width derived from current container width
  const minCellWidth = containerWidth > 0
    ? Math.max(10, Math.floor((containerWidth - COURT_LABEL_W) / SLOT_COUNT))
    : 10;

  // Effective cell width — never less than what fits the container
  const effectiveCellW = Math.max(cellWidth || minCellWidth, minCellWidth);

  useEffect(() => {
    if (!venueId) {
      setCourts([]);
      setLoadCourts({ loading: false, error: '' });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadCourts({ loading: true, error: '' });
      try {
        const data = await getVenueCourts(venueId);
        if (!cancelled) {
          setCourts(Array.isArray(data) ? data : []);
          setLoadCourts({ loading: false, error: '' });
        }
      } catch (e) {
        if (!cancelled) {
          setCourts([]);
          setLoadCourts({
            loading: false,
            error: e.response?.data?.message || e.message || 'Không tải được danh sách sân.',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [venueId]);

  useEffect(() => {
    setSelections({});
  }, [selectedDate]);

  useEffect(() => {
    if (!venueId) {
      setAvailabilityRows([]);
      setLoadAvail({ loading: false, error: '' });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadAvail({ loading: true, error: '' });
      try {
        const data = await getVenueAvailability(venueId, selectedDate);
        if (!cancelled) {
          setAvailabilityRows(Array.isArray(data) ? data : []);
          setLoadAvail({ loading: false, error: '' });
        }
      } catch (e) {
        if (!cancelled) {
          setAvailabilityRows([]);
          setLoadAvail({
            loading: false,
            error: e.response?.data?.message || e.message || 'Không tải được lịch trống.',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [venueId, selectedDate]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    slots.push('24:00');
    return slots;
  }, []);

  const existingBookings = useMemo(() => {
    if (!availabilityRows.length) return [];
    return availabilityRows.flatMap(row =>
      intervalsToGridBlocks(String(row.courtId), row.intervals || [], selectedDate));
  }, [availabilityRows, selectedDate]);

  // ── Cell status ──────────────────────────────────────────────────────────
  const getBookingAt = (courtId, slotIndex) =>
    existingBookings.find(b => b.courtId === courtId && slotIndex >= b.startIndex && slotIndex < b.endIndex);

  const isPastSlot = (slotIndex) => {
    const now = new Date();
    const { end } = slotLocalBounds(selectedDate, slotIndex);
    // Chỉ khóa "slot đã qua" trong ngày hiện tại; các ngày tương lai vẫn chọn bình thường.
    if (!isSameLocalDate(end, now)) return false;
    return end.getTime() <= now.getTime();
  };

  const getCellStatus = (courtId, slotIndex) => {
    if (isPastSlot(slotIndex)) return { status: 'past' };
    const booking = getBookingAt(courtId, slotIndex);
    if (booking) return { status: booking.type, label: booking.label, isBlockStart: slotIndex === booking.startIndex };
    if (selections[courtId]?.has(slotIndex)) return { status: 'selected' };
    return { status: 'free' };
  };

  // ── Interaction logic ────────────────────────────────────────────────────
  // mousedown → snapshot existing selection for this court, then start tracking
  const handleMouseDown = (courtId, slotIndex) => {
    const { status } = getCellStatus(courtId, slotIndex);
    if (status !== 'free' && status !== 'selected') return;

    isDraggingRef.current  = true;
    hasDraggedRef.current  = false;
    dragStartRef.current   = { courtId, slotIndex };
    dragModeRef.current    = status === 'selected' ? 'remove' : 'add';
    // Save a copy of whatever is already selected on this court.
    // The new drag range will be merged/removed against this base.
    dragBaseRef.current    = new Set(selections[courtId] ?? []);
  };

  // mouseenter during drag → merge base selection + current drag range
  const handleMouseEnter = (courtId, slotIndex) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    if (courtId !== dragStartRef.current.courtId) return;
    if (slotIndex === dragStartRef.current.slotIndex) return;

    hasDraggedRef.current = true;

    const start = Math.min(dragStartRef.current.slotIndex, slotIndex);
    const end   = Math.max(dragStartRef.current.slotIndex, slotIndex);

    // If any slot in the new range hits an existing booking, abort the drag update
    for (let i = start; i <= end; i++) {
      if (getBookingAt(courtId, i)) return;
    }

    const nextSet = new Set(dragBaseRef.current);
    if (dragModeRef.current === 'remove') {
      // Drag from a selected slot => unselect the dragged range.
      for (let i = start; i <= end; i++) nextSet.delete(i);
    } else {
      // Drag from a free slot => add the dragged range.
      for (let i = start; i <= end; i++) nextSet.add(i);
    }
    setSelections(prev => {
      const next = { ...prev };
      if (nextSet.size === 0) delete next[courtId];
      else next[courtId] = nextSet;
      return next;
    });
  };

  // mouseup on cell → if pure click, toggle individual slot
  const handleMouseUp = (courtId, slotIndex) => {
    if (!isDraggingRef.current) return;

    if (!hasDraggedRef.current) {
      // Pure click: toggle this one slot, keep other courts unchanged
      const { status } = getCellStatus(courtId, slotIndex);
      if (status === 'free' || status === 'selected') {
        setSelections(prev => {
          const next     = { ...prev };
          const courtSet = new Set(next[courtId] || []);
          if (courtSet.has(slotIndex)) {
            courtSet.delete(slotIndex);
          } else {
            courtSet.add(slotIndex);
          }
          if (courtSet.size === 0) delete next[courtId];
          else next[courtId] = courtSet;
          return next;
        });
      }
    }

    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    dragStartRef.current  = null;
    dragModeRef.current   = 'add';
    dragBaseRef.current   = new Set();
  };

  // Global mouseup: stop drag when mouse released outside any cell
  useEffect(() => {
    const stop = () => {
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      dragStartRef.current  = null;
      dragModeRef.current   = 'add';
      dragBaseRef.current   = new Set();
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // ── Totals ───────────────────────────────────────────────────────────────
  const { totalSlots, totalPrice, totalHours } = useMemo(() => {
    let slots = 0;
    let price = 0;
    courts.forEach(c => {
      const set = selections[c.id];
      if (!set?.size) return;
      set.forEach(slotIdx => {
        slots += 1;
        price += getPriceForSlot(c, slotIdx, selectedDate, pricePerSlot);
      });
    });
    const hours = slots * 0.5;
    const h = Math.floor(hours);
    const m = (hours - h) * 60;
    return { totalSlots: slots, totalPrice: price, totalHours: m > 0 ? `${h}h${m}` : `${h}h` };
  }, [selections, courts, selectedDate, pricePerSlot]);

  // ── Cell colour ──────────────────────────────────────────────────────────
  const getCellColor = status => {
    switch (status) {
      case 'booked':   return '#ef4444';
      case 'locked':   return '#c084fc';
      case 'past':     return '#d1d5db';
      case 'selected': return '#16a34a';
      default:         return '#ffffff';
    }
  };

  const handleAddDayToCart = () => {
    if (totalSlots === 0) return;
    setCart((prev) => {
      let next = [...prev];
      for (const c of courts) {
        const set = selections[c.id];
        if (!set?.size) continue;
        const slots = Array.from(set);
        const idx = next.findIndex((x) => x.date === selectedDate && x.courtId === c.id);
        if (idx >= 0) {
          const merged = [...new Set([...next[idx].slotIndices, ...slots])].sort((a, b) => a - b);
          next = [...next];
          next[idx] = { ...next[idx], slotIndices: merged };
        } else {
          next.push({
            date: selectedDate,
            courtId: c.id,
            courtName: c.name,
            slotIndices: slots.sort((a, b) => a - b),
          });
        }
      }
      return next;
    });
    setSelections({});
  };

  const handleRemoveCartLine = (date, courtId) => {
    setCart((prev) => prev.filter((x) => !(x.date === date && x.courtId === courtId)));
  };

  const handleClearCart = () => setCart([]);

  const handleProceedConfirm = () => {
    if (cart.length === 0) return;
    const apiItems = buildFlexibleApiItems(cart, courts, pricePerSlot);
    if (apiItems.length === 0) return;
    const slotCount = cartSlotCount(cart);
    const totalCart = cartTotalPrice(cart, courts, pricePerSlot);
    const sessionDays = new Set(cart.map((e) => e.date)).size;
    const hFloat = slotCount * 0.5;
    const th = Math.floor(hFloat);
    const tm = (hFloat - th) * 60;
    const totalHours = tm > 0 ? `${th}h${tm}` : `${th}h`;

    const padTwo = (n) => String(n).padStart(2, '0');
    const selectedSlots = [];
    for (const line of cart) {
      const court = courts.find((c) => c.id === line.courtId);
      if (!court) continue;
      for (const slotIdx of [...line.slotIndices].sort((a, b) => a - b)) {
        const { start, end } = slotLocalBounds(line.date, slotIdx);
        selectedSlots.push({
          courtName: line.courtName,
          timeLabel: `${padTwo(start.getHours())}:${padTwo(start.getMinutes())}`,
          timeEndLabel: `${padTwo(end.getHours())}:${padTwo(end.getMinutes())}`,
          price: getPriceForSlot(court, slotIdx, line.date, pricePerSlot),
          slotIndex: slotIdx,
          dateIso: line.date,
        });
      }
    }

    const sortedDates = [...new Set(cart.map((l) => l.date))].sort();
    const date = sortedDates[0] ?? new Date().toISOString().split('T')[0];

    navigate('/booking/long-term/flexible/confirm', {
      state: {
        venueId,
        venueName,
        venueAddress,
        pricePerSlot,
        items: apiItems,
        cart,
        selectedSlots,
        date,
        preview: {
          slotCount,
          sessionCount: sessionDays,
          totalAmount: totalCart,
        },
        totalHours,
        totalPrice: totalCart,
      },
    });
  };

  const handleClearSelections = () => {
    setSelections({});
  };

  const cartSlots = cartSlotCount(cart);
  const cartMoney = cartTotalPrice(cart, courts, pricePerSlot);

  if (!venueId) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <p className="mb-3">Thiếu thông tin cơ sở.</p>
        <Link to="/venues" className="btn btn-primary">Tìm sân</Link>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  // paddingTop: 96px compensates for the fixed site navbar
  return (
    <div style={{ backgroundColor: '#f0fdf4', minHeight: '100vh', paddingTop: '96px', paddingBottom: '80px' }}>

      {/* ── Booking step progress ───────────────────────────────────────── */}
      <LongTermBookingSteps
        currentStep={1}
        scheduleStepPath="/booking/long-term/flexible"
        scheduleStepLabel="Lịch linh hoạt"
        confirmPath="/booking/long-term/flexible/confirm"
      />

      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div
        className="d-flex justify-content-between align-items-center px-4 py-3"
        style={{ backgroundColor: '#0f766e' }}
      >
        <div>
          <h5 className="mb-0 text-white fw-semibold">Đặt lịch dài hạn — linh hoạt</h5>
          {venueName !== 'Chọn sân' && (
            <small className="text-white opacity-75">{venueName}{venueAddress ? ` — ${venueAddress}` : ''}</small>
          )}
        </div>

        {/* Date picker button */}
        <button
          onClick={() => setShowCalendar(true)}
          className="d-flex align-items-center gap-2 px-3 py-2 rounded"
          style={{
            backgroundColor: '#115e59', border: '1px solid #14b8a6',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
          }}
        >
          📅 {formatDateVN(selectedDate)}
        </button>
      </div>

      {/* ── Banner Discount ────────────────────────────────────────────── */}
      {(venueState.weeklyDiscountPercent > 0 || venueState.monthlyDiscountPercent > 0) && (
        <div className="alert alert-success d-flex flex-column mx-4 mt-4 mb-2 border-success bg-white shadow-sm" style={{ borderLeft: '4px solid #198754' }}>
           <div className="d-flex align-items-center mb-1">
             <i className="feather-star me-2 fs-5 text-success" />
             <strong className="text-success" style={{ fontSize: '1.05rem' }}>Ưu đãi áp dụng tự động cho đặt lịch dài hạn:</strong>
           </div>
           <div className="ps-4 ms-2 mt-1">
             {venueState.weeklyDiscountPercent > 0 && (
               <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.weeklyDiscountPercent}%</strong> khi ngày bắt đầu và kết thúc cách nhau từ 7 ngày trở lên.</div>
             )}
             {venueState.monthlyDiscountPercent > 0 && (
               <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.monthlyDiscountPercent}%</strong> khi ngày bắt đầu và kết thúc cách nhau từ 30 ngày trở lên.</div>
             )}
             <div className="text-muted small mt-2"><i className="feather-info me-1" /> Lưu ý: Hệ thống chỉ tự động áp dụng 1 mức giảm giá cao nhất dựa theo khoảng cách thời gian từ ngày đầu tiên tới ngày cuối cùng trong đơn liền mạch này.</div>
           </div>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center flex-wrap gap-3 bg-white px-4 py-2 border-bottom mt-2">
        {[
          { color: '#ffffff', border: '#ccc', label: 'Trống' },
          { color: '#ef4444', label: 'Đã đặt' },
          { color: '#d1d5db', label: 'Đã qua' },
          { color: '#9ca3af', label: 'Khoá' },
          { color: '#c084fc', label: 'Sự kiện' },
          { color: '#16a34a', label: 'Đang chọn' },
        ].map(({ color, border, label }) => (
          <div key={label} className="d-flex align-items-center gap-1">
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px',
              backgroundColor: color, border: `1px solid ${border || color}`, flexShrink: 0,
            }} />
            <span style={{ fontSize: '13px' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
          💡 Chọn ô trên lưới · &quot;Thêm ngày vào đơn&quot; để gom nhiều ngày
        </span>
      </div>

      {venueId && cart.length > 0 && (
        <div className="mx-3 mt-2 p-3 bg-white rounded border" style={{ borderColor: '#86efac' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="text-success">Giỏ lịch dài hạn</strong>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleClearCart}>Xóa giỏ</button>
          </div>
          <ul className="list-unstyled small mb-0">
            {cart.map((line) => (
              <li key={`${line.date}-${line.courtId}`} className="d-flex justify-content-between py-1 border-bottom">
                <span>
                  {formatDateVN(line.date)} · {line.courtName} · {line.slotIndices.length} ô
                </span>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger p-0"
                  onClick={() => handleRemoveCartLine(line.date, line.courtId)}
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
          <p className="small text-muted mb-0 mt-2">
            Tạm tính giỏ: <strong>{cartMoney.toLocaleString('vi-VN')} VNĐ</strong> ({cartSlots} ô)
          </p>
        </div>
      )}

      {!venueId && (
        <div className="text-center py-4 px-3 bg-white m-3 rounded shadow-sm">
          <p className="mb-2">Bạn chưa chọn cơ sở để đặt.</p>
          <Link to="/venues" className="btn btn-primary btn-sm">Tìm sân</Link>
        </div>
      )}

      {venueId && loadCourts.loading && (
        <div className="text-center py-4 text-muted">Đang tải danh sách sân…</div>
      )}
      {loadCourts.error && (
        <div className="alert alert-danger m-3 mb-0" role="alert">{loadCourts.error}</div>
      )}
      {venueId && !loadCourts.loading && !loadCourts.error && courts.length === 0 && (
        <div className="text-center py-4 text-muted">Chưa có sân hoạt động tại cơ sở này.</div>
      )}

      {venueId && loadAvail.loading && !loadAvail.error && (
        <div className="text-center py-2 small text-muted">Đang cập nhật lịch trống…</div>
      )}
      {loadAvail.error && (
        <div className="alert alert-warning m-3 mb-0" role="alert">{loadAvail.error}</div>
      )}

      {/* ── Timeline Grid ──────────────────────────────────────────────── */}
      <div
        ref={gridContainerRef}
        style={{ overflowX: effectiveCellW <= minCellWidth ? 'hidden' : 'auto', backgroundColor: '#fff', margin: '12px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <div style={{ minWidth: effectiveCellW <= minCellWidth ? '100%' : `${COURT_LABEL_W + (timeSlots.length - 1) * effectiveCellW}px` }}>

          {/* Time header row — sticky */}
          <div
            className="d-flex"
            style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #d1fae5', position: 'sticky', top: 0, zIndex: 20 }}
          >
            <div style={{
              width: '72px', minWidth: '72px', position: 'sticky', left: 0,
              backgroundColor: '#f0fdf4', zIndex: 21, borderRight: '1px solid #d1fae5',
            }} />
            {timeSlots.slice(0, -1).map((slot, i) => (
              <div
                key={i}
                style={{
                  flex: effectiveCellW <= minCellWidth ? '1 1 0' : 'none',
                  width: effectiveCellW <= minCellWidth ? 'auto' : `${effectiveCellW}px`,
                  minWidth: effectiveCellW <= minCellWidth ? 0 : `${effectiveCellW}px`,
                  flexShrink: effectiveCellW <= minCellWidth ? 1 : 0,
                  textAlign: 'center',
                  fontSize: effectiveCellW < 28 ? '9px' : '11px', color: '#0369a1', padding: '6px 0',
                  borderRight: '1px solid #e0f2fe', overflow: 'hidden',
                }}
              >{effectiveCellW >= 26 ? slot : (i % 2 === 0 ? slot : '')}</div>
            ))}
          </div>

          {/* Court rows */}
          {courts.map(court => (
            <div key={court.id} className="d-flex" style={{ borderBottom: '1px solid #e5e7eb' }}>

              {/* Court name — sticky */}
              <div style={{
                width: '72px', minWidth: '72px', position: 'sticky', left: 0,
                backgroundColor: '#f8fafc', zIndex: 10, borderRight: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '600', color: '#374151',
              }}>
                {court.name}
              </div>

              {/* Time cells */}
              {timeSlots.slice(0, -1).map((_, slotIdx) => {
                const { status, label, isBlockStart } = getCellStatus(court.id, slotIdx);
                const bg          = getCellColor(status);
                const isClickable = status === 'free' || status === 'selected';

                return (
                  <div
                    key={slotIdx}
                    onMouseDown={() => handleMouseDown(court.id, slotIdx)}
                    onMouseEnter={() => handleMouseEnter(court.id, slotIdx)}
                    onMouseUp={() => handleMouseUp(court.id, slotIdx)}
                    style={{
                      flex: effectiveCellW <= minCellWidth ? '1 1 0' : 'none',
                      width: effectiveCellW <= minCellWidth ? 'auto' : `${effectiveCellW}px`,
                      minWidth: effectiveCellW <= minCellWidth ? 0 : `${effectiveCellW}px`,
                      flexShrink: effectiveCellW <= minCellWidth ? 1 : 0,
                      height: '44px',
                      backgroundColor: bg,
                      borderRight: '1px solid #e5e7eb',
                      cursor: isClickable ? 'pointer' : 'not-allowed',
                      userSelect: 'none',
                      display: 'flex', alignItems: 'center',
                      overflow: 'hidden', position: 'relative',
                    }}
                    title={label || undefined}
                  >
                    {isBlockStart && label && (
                      <span style={{
                        fontSize: '10px', color: '#fff', paddingLeft: '4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        position: 'absolute', left: 0, right: 0,
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

      {/* ── Zoom slider — floating pill (bottom-right, above footer) ──── */}
      <div style={{
        position: 'fixed', bottom: '76px', right: '20px', zIndex: 999,
        backgroundColor: '#fff', borderRadius: '999px',
        padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px',
      }}>
        <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>🔍</span>
        <input
          type="range"
          min={minCellWidth}
          max={MAX_CELL_W}
          value={effectiveCellW}
          onChange={e => setCellWidth(Number(e.target.value))}
          style={{
            flex: 1, accentColor: '#16a34a', cursor: 'pointer', height: '4px',
          }}
        />
        <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>🔎</span>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="fixed-bottom d-flex justify-content-between align-items-center px-4 py-3 border-top shadow"
        style={{ backgroundColor: '#fff', zIndex: 1000 }}
      >
        <div className="d-flex align-items-center flex-wrap gap-3">
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Ngày đang chọn: <strong style={{ color: '#111' }}>{totalSlots > 0 ? totalHours : '0h'}</strong>
            {' · '}
            <strong style={{ color: '#16a34a' }}>{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
          </span>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Giỏ: <strong>{cartSlots}</strong> ô · <strong>{cartMoney.toLocaleString('vi-VN')} VNĐ</strong>
          </span>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={totalSlots === 0}
            onClick={handleClearSelections}
            style={{
              backgroundColor: totalSlots > 0 ? '#ef4444' : '#fecaca',
              color: '#fff',
              border: `1px solid ${totalSlots > 0 ? '#dc2626' : '#fecaca'}`,
              borderRadius: '8px',
              fontSize: '13px',
              padding: '10px 12px',
              cursor: totalSlots > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Xóa chọn trong ngày
          </button>
          <button
            type="button"
            disabled={totalSlots === 0}
            onClick={handleAddDayToCart}
            style={{
              backgroundColor: totalSlots > 0 ? '#0d9488' : '#99f6e4',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              padding: '10px 14px',
              cursor: totalSlots > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Thêm ngày vào đơn
          </button>
          <button
            disabled={cart.length === 0}
            onClick={handleProceedConfirm}
            style={{
              backgroundColor: cart.length > 0 ? '#eab308' : '#d1d5db',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '15px', letterSpacing: '0.5px', padding: '10px 24px',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Tiếp tục xác nhận
          </button>
        </div>
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

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';
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
  const todayIso    = localIsoDate(today);

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
/** Trả về chuỗi YYYY-MM-DD theo múi giờ LOCAL (không dùng UTC). */
function localIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

const START_HOUR = 5;
const END_HOUR = 24;

/** Tính số ô grid dựa trên slotDuration (phút) */
function computeSlotCount(slotDurationMins) {
  return Math.floor((END_HOUR - START_HOUR) * 60 / slotDurationMins);
}

function slotLocalBounds(dateStr, slotIndex, slotDurationMins = 30) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const mins = START_HOUR * 60 + slotIndex * slotDurationMins;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const start = new Date(y, m - 1, d, hh, mm, 0, 0);
  const end = new Date(start.getTime() + slotDurationMins * 60 * 1000);
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

function getPriceForSlot(court, slotIndex, dateStr, fallbackPerSlot, slotDurationMins = 30) {
  const { start } = slotLocalBounds(dateStr, slotIndex, slotDurationMins);
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

function normalizeGroupName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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

const BLOCK_REASON_LABELS = {
  MAINTENANCE: 'Bảo trì',
  WEATHER: 'Thời tiết / môi trường',
  OTHER: 'Khác',
};

/** Nhãn hiển thị / tooltip cho ô khóa lịch (public availability). */
function labelForBlockedInterval(iv) {
  const detail = String(iv.reasonDetail ?? iv.ReasonDetail ?? '').trim();
  if (detail) return detail;
  const code = iv.reasonCode ?? iv.ReasonCode;
  if (code && BLOCK_REASON_LABELS[code]) return BLOCK_REASON_LABELS[code];
  return 'Khóa lịch';
}

function intervalsToGridBlocks(courtId, intervals, dateStr, slotDurationMins = 30) {
  if (!intervals?.length) return [];
  const slotCount = computeSlotCount(slotDurationMins);
  const blocks = [];
  for (const iv of intervals) {
    const ivStart = new Date(iv.start).getTime();
    const ivEnd = new Date(iv.end).getTime();
    if (Number.isNaN(ivStart) || Number.isNaN(ivEnd)) continue;
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < slotCount; i++) {
      const { start, end } = slotLocalBounds(dateStr, i, slotDurationMins);
      if (ivOverlapsSlot(ivStart, ivEnd, start.getTime(), end.getTime())) {
        if (startIndex < 0) startIndex = i;
        endIndex = i + 1;
      }
    }
    if (startIndex >= 0) {
      const kind = iv.kind === 'blocked' ? 'locked' : iv.kind === 'closed' ? 'closed' : 'booked';
      const label = iv.kind === 'blocked' ? labelForBlockedInterval(iv) : undefined;
      blocks.push({ courtId, startIndex, endIndex, type: kind, label });
    }
  }
  return blocks;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BookingTimeline() {
  const navigate = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  // Venue info passed from VenueDetails
  const venueState = location.state ?? {};
  const venueName    = venueState.venueName    ?? 'Chọn sân';
  const venueAddress = venueState.venueAddress ?? '';
  const venueId      = venueState.venueId      ?? null;
  const pricePerSlot = venueState.pricePerSlot ?? 100000;

  // ── Slot Duration (from venue state cache or API fallback) ──────────────
  const [slotDuration, setSlotDuration] = useState(() => {
    const fromState = venueState.slotDuration;
    return [30, 60, 120].includes(fromState) ? fromState : 60;
  });

  // Only fetch from API if navigation state didn't provide slotDuration
  // (e.g., page refresh on /booking, direct URL, or sessionStorage restore)
  useEffect(() => {
    if (!venueId) return;
    // Skip API call if we already have a trusted value from navigation state
    if ([30, 60, 120].includes(venueState.slotDuration)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const sd = data.slotDuration || data.SlotDuration || 60;
          setSlotDuration([30, 60, 120].includes(sd) ? sd : 60);
        }
      } catch (err) {
        console.warn('Failed to fetch venue slotDuration', err);
      }
    })();
    return () => { cancelled = true; };
  }, [venueId, venueState.slotDuration]);

  // Derived grid constants based on slotDuration
  const SLOT_COUNT = useMemo(() => computeSlotCount(slotDuration), [slotDuration]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const fromState = venueState.date;
    // Only restore date when coming back with explicit router state (confirm -> timeline)
    if (fromState && venueState.selectedSlots) return fromState;
    return localIsoDate(new Date());
  });
  const [showCalendar, setShowCalendar]  = useState(false);

  // Initial selected slots only from explicit router state (confirm -> timeline).
  const initialSelections = useMemo(() => {
    const init = {};

    if (venueState.selectedSlots && (venueState.date === undefined || venueState.date === selectedDate)) {
      venueState.selectedSlots.forEach(s => {
        if (!init[s.courtId]) init[s.courtId] = new Set();
        init[s.courtId].add(s.slotIndex);
      });
    }
    return init;
  }, [venueState.selectedSlots, venueState.date, selectedDate]);

  // Ref to measure the grid container for computing the exact "fit" minimum
  const gridContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // cellWidth is the zoom level controlled by the slider
  // It's always clamped to >= minCellWidth so slider-at-min = no scroll
  const [cellWidth, setCellWidth] = useState(0); // 0 = uninitialized, will be set to minCellWidth on first measure
  const [hasManualZoom, setHasManualZoom] = useState(false);

  // selections: { [courtId]: Set<slotIndex> }
  const [selections, setSelections] = useState(initialSelections);

  const [courts, setCourts] = useState([]);
  const [availabilityRows, setAvailabilityRows] = useState([]);
  const [loadCourts, setLoadCourts] = useState({ loading: false, error: '' });
  const [loadAvail, setLoadAvail] = useState({ loading: false, error: '' });

  const hasGroupedCourts = useMemo(
    () => courts.some((c) => String(c.groupName ?? c.GroupName ?? c.group_name ?? '').trim().length > 0),
    [courts],
  );

  const groupedCourts = useMemo(() => {
    if (!hasGroupedCourts) return { __ALL__: courts };
    const grouped = {};
    const displayByKey = {};
    courts.forEach((court) => {
      const rawGroupName = String(court.groupName ?? court.GroupName ?? court.group_name ?? '').trim();
      const groupKey = rawGroupName ? normalizeGroupName(rawGroupName) : '__UNGROUPED__';
      if (!grouped[groupKey]) grouped[groupKey] = [];
      if (!displayByKey[groupKey]) displayByKey[groupKey] = rawGroupName || 'Chưa phân nhóm';
      grouped[groupKey].push(court);
    });
    return Object.entries(grouped).reduce((acc, [key, rows]) => {
      acc[displayByKey[key] || 'Chưa phân nhóm'] = rows;
      return acc;
    }, {});
  }, [courts, hasGroupedCourts]);

  // Drag refs — distinguish click vs drag
  const isDraggingRef  = useRef(false);
  const hasDraggedRef  = useRef(false);
  const dragStartRef   = useRef(null); // { courtId, slotIndex }
  const dragModeRef    = useRef('add'); // add | remove
  // Snapshot of the court's selection BEFORE the current drag started
  // so new drag ranges ADD to existing selection rather than replace it
  const dragBaseRef    = useRef(new Set());

  // ── Responsive min cell width ────────────────────────────────────────────
  const GROUP_LABEL_W = hasGroupedCourts ? 96 : 0; // px reserved for group name column
  const COURT_LABEL_W = 72; // px reserved for court name column
  const LEFT_LABEL_W = GROUP_LABEL_W + COURT_LABEL_W;
  const BASE_MAX_CELL_W = 56; // default maximum zoom target
  const COURT_ROW_H = 44;
  const ROW_BORDER_W = 1;

  // Measure container and derive minCellWidth dynamically
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const measure = (width) => {
      const slots = SLOT_COUNT;
      const minW = Math.max(10, Math.floor((width - LEFT_LABEL_W) / slots));
      setContainerWidth(width);
      setCellWidth(prev => {
        // On first measure (prev===0) default to minW; otherwise preserve user zoom but re-clamp
        if (prev === 0) return minW;
        return Math.max(minW, prev);
      });
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [SLOT_COUNT, LEFT_LABEL_W]);

  // Minimum cell width derived from current container width
  const minCellWidth = containerWidth > 0
    ? Math.max(10, Math.floor((containerWidth - LEFT_LABEL_W) / SLOT_COUNT))
    : 10;

  // Ensure slider is always valid even when minCellWidth > default max.
  const sliderMaxCellW = Math.max(BASE_MAX_CELL_W, minCellWidth + 24);

  // Effective cell width — never less than what fits the container
  const effectiveCellW = Math.min(
    Math.max(cellWidth || minCellWidth, minCellWidth),
    sliderMaxCellW,
  );

  // Keep default zoom at minimum until user intentionally drags the slider.
  useEffect(() => {
    setCellWidth((prev) => {
      if (!hasManualZoom) return minCellWidth;
      const base = prev || minCellWidth;
      return Math.min(Math.max(base, minCellWidth), sliderMaxCellW);
    });
  }, [minCellWidth, sliderMaxCellW, hasManualZoom]);

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
    for (let i = 0; i < SLOT_COUNT; i++) {
      const totalMins = START_HOUR * 60 + i * slotDuration;
      const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const mm = String(totalMins % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    // Push end label
    const endMins = START_HOUR * 60 + SLOT_COUNT * slotDuration;
    const endHH = String(Math.floor(endMins / 60)).padStart(2, '0');
    const endMM = String(endMins % 60).padStart(2, '0');
    slots.push(`${endHH}:${endMM}`);
    return slots;
  }, [slotDuration, SLOT_COUNT]);

  const existingBookings = useMemo(() => {
    if (!availabilityRows.length) return [];
    return availabilityRows.flatMap(row =>
      intervalsToGridBlocks(String(row.courtId), row.intervals || [], selectedDate, slotDuration));
  }, [availabilityRows, selectedDate, slotDuration]);

  // ── Cell status ──────────────────────────────────────────────────────────
  const getBookingAt = (courtId, slotIndex) =>
    existingBookings.find(b => b.courtId === courtId && slotIndex >= b.startIndex && slotIndex < b.endIndex);

  const isPastSlot = (slotIndex) => {
    const now = new Date();
    const { end } = slotLocalBounds(selectedDate, slotIndex, slotDuration);
    // Nếu thời điểm kết thúc slot <= hiện tại → slot đã qua.
    // Hoạt động đúng cho cả ngày đã qua lẫn các slot đã qua trong ngày hôm nay.
    // Các ngày tương lai thì end > now → trả về false → vẫn chọn được.
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
        price += getPriceForSlot(c, slotIdx, selectedDate, pricePerSlot, slotDuration);
      });
    });
    const totalMinutes = slots * slotDuration;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { totalSlots: slots, totalPrice: price, totalHours: m > 0 ? `${h}h${m}` : `${h}h` };
  }, [selections, courts, selectedDate, pricePerSlot, slotDuration]);

  // ── Cell colour ──────────────────────────────────────────────────────────
  const getCellColor = status => {
    switch (status) {
      case 'booked':   return '#ef4444';
      case 'locked':   return '#c084fc';
      case 'closed':   return '#9ca3af';
      case 'past':     return '#d1d5db';
      case 'selected': return '#16a34a';
      default:         return '#ffffff';
    }
  };

  const handleNext = () => {
    if (totalSlots === 0) return;
    const selectedSlots = courts.flatMap(c =>
      Array.from(selections[c.id] ?? [])
        .sort((a, b) => a - b)
        .map(slotIdx => {
          const { start, end } = slotLocalBounds(selectedDate, slotIdx, slotDuration);
          return {
            courtId:   c.id,
            courtName: c.name,
            slotIndex: slotIdx,
            timeLabel: timeSlots[slotIdx],
            timeEndLabel: timeSlots[slotIdx + 1] ?? '',
            price:     getPriceForSlot(c, slotIdx, selectedDate, pricePerSlot, slotDuration),
            startTime: toLocalDateTimeString(start),
            endTime:   toLocalDateTimeString(end),
            slotDuration,
          };
        })
    );
    navigate('/booking/confirm', {
      state: {
        venueId,
        venueName,
        venueAddress,
        date:          selectedDate,
        selectedSlots,
        totalPrice,
        totalHours,
      },
    });
  };

  const handleClearSelections = () => {
    setSelections({});
  };

  // ── Render ───────────────────────────────────────────────────────────────
  // paddingTop: 96px compensates for the fixed site navbar
  return (
    <div className="content-below-header" style={{ backgroundColor: '#f0fdf4', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* ── Booking step progress ───────────────────────────────────────── */}
      <BookingSteps currentStep={1} />

      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div
        className="d-flex justify-content-between align-items-center px-4 py-3"
        style={{ backgroundColor: '#0f766e' }}
      >
        <div>
          <h5 className="mb-0 text-white fw-semibold">Đặt lịch ngày trực quan</h5>
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

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="d-flex align-items-center flex-wrap gap-3 bg-white px-4 py-2 border-bottom">
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
          💡 Click để chọn từng ô · Kéo để chọn nhiều ô liên tiếp
        </span>
      </div>

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
        <div style={{ minWidth: effectiveCellW <= minCellWidth ? '100%' : `${LEFT_LABEL_W + (timeSlots.length - 1) * effectiveCellW}px` }}>

          {/* Time header row — sticky */}
          <div
            className="d-flex"
            style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #d1fae5', position: 'sticky', top: 0, zIndex: 20 }}
          >
            {hasGroupedCourts && (
              <div style={{
                width: `${GROUP_LABEL_W}px`, minWidth: `${GROUP_LABEL_W}px`, position: 'sticky', left: 0,
                backgroundColor: '#f0fdf4', zIndex: 22, borderRight: '1px solid #d1fae5',
                fontSize: '11px', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              }}>Nhóm</div>
            )}
            <div style={{
              width: `${COURT_LABEL_W}px`, minWidth: `${COURT_LABEL_W}px`, position: 'sticky', left: `${GROUP_LABEL_W}px`,
              backgroundColor: '#f0fdf4', zIndex: 21, borderRight: '1px solid #d1fae5',
              fontSize: '11px', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>Sân</div>
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
          {Object.entries(groupedCourts).map(([groupName, groupCourts]) => (
            <React.Fragment key={groupName}>
              {groupCourts.map((court, groupIndex) => (
                <div key={court.id} className="d-flex">

              {/* Group name — sticky column 1 */}
              {hasGroupedCourts && (
                <div style={{
                  width: `${GROUP_LABEL_W}px`, minWidth: `${GROUP_LABEL_W}px`, position: 'sticky', left: 0,
                  backgroundColor: '#ecfeff', zIndex: 12, borderRight: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd',
                  fontSize: '12px', fontWeight: '700', color: '#0e7490', textAlign: 'center',
                  padding: '0 4px', lineHeight: 1.2,
                  height: `${COURT_ROW_H}px`,
                  overflow: 'hidden',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {groupIndex === Math.floor((groupCourts.length - 1) / 2) ? groupName : ''}
                </div>
              )}

              {/* Court name — sticky column 2 */}
              <div style={{
                width: `${COURT_LABEL_W}px`, minWidth: `${COURT_LABEL_W}px`, position: 'sticky', left: `${GROUP_LABEL_W}px`,
                backgroundColor: '#f8fafc', zIndex: 10, borderRight: '1px solid #e5e7eb',
                borderBottom: '1px solid #e5e7eb',
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
                      borderBottom: '1px solid #e5e7eb',
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
            </React.Fragment>
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
          max={sliderMaxCellW}
          value={effectiveCellW}
          onChange={e => {
            setHasManualZoom(true);
            setCellWidth(Number(e.target.value));
          }}
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
        <div className="d-flex align-items-center gap-4">
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Tổng giờ: <strong style={{ color: '#111' }}>{totalSlots > 0 ? totalHours : '0h'}</strong>
          </span>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Tổng tiền: <strong style={{ color: '#16a34a', fontSize: '16px' }}>{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            disabled={totalSlots === 0}
            onClick={handleClearSelections}
            style={{
              backgroundColor: totalSlots > 0 ? '#ef4444' : '#fecaca',
              color: '#fff',
              border: `1px solid ${totalSlots > 0 ? '#dc2626' : '#fecaca'}`,
              borderRadius: '8px',
              fontSize: '14px',
              padding: '10px 16px',
              cursor: totalSlots > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            XÓA TẤT CẢ
          </button>
          <button
            disabled={totalSlots === 0}
            onClick={handleNext}
            style={{
              backgroundColor: totalSlots > 0 ? '#eab308' : '#d1d5db',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '15px', letterSpacing: '0.5px', padding: '10px 40px',
              cursor: totalSlots > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            TIẾP THEO
          </button>
        </div>
      </div>

      {/* ── Calendar Popup ─────────────────────────────────────────────── */}
      {showCalendar && (
        <CalendarPopup
          value={selectedDate}
          onChange={d => {
            if (d !== selectedDate) {
              setSelectedDate(d);
              setSelections({});
            }
          }}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}

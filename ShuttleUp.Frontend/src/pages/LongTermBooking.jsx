import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { getVenueCourts, previewLongTermBooking, previewDiscount } from '../api/bookingApi';
import ShuttleDateField from '../components/ui/ShuttleDateField';

/* ── Constants ────────────────────────────────────────────── */
const DAY_OPTS = [
  { v: 1, label: 'T2',  full: 'Thứ Hai' },
  { v: 2, label: 'T3',  full: 'Thứ Ba' },
  { v: 3, label: 'T4',  full: 'Thứ Tư' },
  { v: 4, label: 'T5',  full: 'Thứ Năm' },
  { v: 5, label: 'T6',  full: 'Thứ Sáu' },
  { v: 6, label: 'T7',  full: 'Thứ Bảy' },
  { v: 0, label: 'CN',  full: 'Chủ Nhật' },
];

/** Build duration dropdown options aligned to the venue's slot grid */
function buildDurationOpts(slotMins = 60) {
  const stepHours = slotMins / 60; // 0.5, 1, or 2
  const opts = [];
  for (let h = stepHours; h <= 4; h += stepHours) {
    const label = h < 1 ? `${Math.round(h * 60)} phút` : h % 1 === 0 ? `${h} tiếng` : `${h} tiếng`;
    opts.push({ value: h, label });
  }
  return opts;
}

/** Format slot label e.g. "30 phút", "1 giờ", "2 giờ" */
function slotLabel(mins) {
  if (mins < 60) return `${mins} phút`;
  if (mins === 60) return '1 giờ';
  return `${mins / 60} giờ`;
}

function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Add hours to a HH:mm string, return HH:mm */
function addHoursToTime(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const nh = Math.floor(totalMinutes / 60) % 24;
  const nm = totalMinutes % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** Compute duration in hours between two HH:mm strings */
function computeDuration(startStr, endStr) {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : 0;
}

export default function LongTermBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  let venueState = location.state;
  if (!venueState) {
    try {
      const cached = sessionStorage.getItem('booking_venue_context');
      if (cached) venueState = JSON.parse(cached);
    } catch { }
  }
  venueState = venueState || {};

  const venueId = venueState.venueId ?? null;
  const venueName = venueState.venueName ?? 'Cơ sở';
  const venueAddress = venueState.venueAddress ?? '';

  /** Detect if user returned from Step 2 (editing mode) */
  const isEditing = !!(venueState.daysOfWeek?.length > 0 && venueState.rangeStart);

  /* ── Slot Duration (from venue config) ── */
  const [slotDuration, setSlotDuration] = useState(() => {
    const sd = venueState.slotDuration;
    return [30, 60, 120].includes(sd) ? sd : 60;
  });

  /* Duration options — aligned to venue's slot grid */
  const DURATION_OPTS = useMemo(() => buildDurationOpts(slotDuration), [slotDuration]);

  /* Hourly price multiplier: how many slots make 1 hour */
  const slotsPerHour = 60 / slotDuration;

  /* ── Courts ──────────────────────────── */
  const [courts, setCourts] = useState([]);
  const [loadCourts, setLoadCourts] = useState({ loading: false, error: '' });
  const [courtId, setCourtId] = useState(venueState.courtId || '');
  const [autoSwitchCourt, setAutoSwitchCourt] = useState(venueState.autoSwitchCourt || false);
  const [pricePreference, setPricePreference] = useState(venueState.pricePreference || 'BEST');

  /* ── Date range ────────────────────────── */
  const [rangeStart, setRangeStart] = useState(venueState.rangeStart || todayIso());
  const [rangeEnd, setRangeEnd] = useState(venueState.rangeEnd || todayIso());

  const handleRangeStartChange = (ymd) => {
    setRangeStart(ymd);
    if (rangeEnd < ymd) {
      setRangeEnd(ymd);
    }
  };

  /* ── Days selection ────────────────────── */
  const [days, setDays] = useState(venueState.daysOfWeek || []);

  /* ── Sync toggle ───────────────────────── */
  const [isSyncTime, setIsSyncTime] = useState(!venueState.dailySchedules);

  /* ── Per-day time config ────────────────── */
  const defaultDuration = slotDuration >= 120 ? 2 : 2;
  const defaultTime = { start: '18:00', end: '20:00', duration: defaultDuration };
  const [dayTimes, setDayTimes] = useState(() => {
    const init = {};
    if (venueState.dailySchedules && venueState.dailySchedules.length > 0) {
      venueState.dailySchedules.forEach(ds => {
        init[ds.dayOfWeek] = {
           start: ds.startTime,
           end: ds.endTime,
           duration: computeDuration(ds.startTime, ds.endTime)
        };
      });
      DAY_OPTS.forEach(d => { if (!init[d.v]) init[d.v] = { ...defaultTime }; });
    } else if (venueState.sessionStartTime && venueState.sessionEndTime) {
      const dur = computeDuration(venueState.sessionStartTime, venueState.sessionEndTime);
      DAY_OPTS.forEach(d => {
        init[d.v] = { start: venueState.sessionStartTime, end: venueState.sessionEndTime, duration: dur };
      });
    } else {
      DAY_OPTS.forEach(d => { init[d.v] = { ...defaultTime }; });
    }
    return init;
  });

  /* ── Accordion open state ──────────────── */
  const [openDays, setOpenDays] = useState({});

  /* ── Preview ───────────────────────────── */
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'startTime', direction: 'asc' });

  /* ── Sticky CTA visibility ─────────────── */
  const previewRef = useRef(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  /* IntersectionObserver: show sticky bar when inline CTA is out of viewport */
  useEffect(() => {
    if (!previewRef.current) return;
    const el = previewRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preview]);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    (async () => {
      setLoadCourts({ loading: true, error: '' });
      try {
        const data = await getVenueCourts(venueId);
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setCourts(list);
          if (list.length && !courtId) setCourtId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          setCourts([]);
          setLoadCourts({
            loading: false,
            error: e.response?.data?.message || e.message || 'Không tải được danh sách sân.',
          });
        }
      } finally {
        if (!cancelled) setLoadCourts((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [venueId]);

  /* ── Fetch slotDuration from API if not in state ─── */
  useEffect(() => {
    if (!venueId) return;
    if ([30, 60, 120].includes(venueState.slotDuration)) return;
    (async () => {
      try {
        const resp = await fetch(`/api/venues/${venueId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        const sd = data.slotDuration || data.SlotDuration || 60;
        setSlotDuration([30, 60, 120].includes(sd) ? sd : 60);
      } catch (err) {
        console.warn('Failed to fetch venue slotDuration', err);
      }
    })();
  }, [venueId, venueState.slotDuration]);

  /* ── Layout Resets ──────────────────────── */
  const handleClearAll = () => {
    setCourtId('');
    setAutoSwitchCourt(false);
    setPricePreference('BEST');
    setRangeStart(todayIso());
    setRangeEnd(todayIso());
    setDays([]);
    setIsSyncTime(true);
    setDayTimes(() => {
       const init = {};
       DAY_OPTS.forEach(d => { init[d.v] = { ...defaultTime }; });
       return init;
    });
    setPreview(null);
    setPreviewError('');
  };

  /* ── Day helpers ────────────────────────── */
  const toggleDay = (v) => {
    setDays((prev) =>
      prev.includes(v)
        ? prev.filter((x) => x !== v)
        : [...prev, v].sort((a, b) => {
            const order = [1,2,3,4,5,6,0];
            return order.indexOf(a) - order.indexOf(b);
          })
    );
  };

  const toggleAccordion = (v) => {
    setOpenDays((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  /* ── Time change handlers ──────────────── */
  const handleStartChange = (dayV, newStart) => {
    if (isSyncTime) {
      // Sync: apply to all days
      setDayTimes((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          const dur = next[k].duration;
          next[k] = { ...next[k], start: newStart, end: addHoursToTime(newStart, dur) };
        });
        return next;
      });
    } else {
      setDayTimes((prev) => {
        const dur = prev[dayV].duration;
        return { ...prev, [dayV]: { ...prev[dayV], start: newStart, end: addHoursToTime(newStart, dur) } };
      });
    }
  };

  const handleEndChange = (dayV, newEnd) => {
    if (isSyncTime) {
      setDayTimes((prev) => {
        const next = { ...prev };
        const dur = computeDuration(prev[dayV].start, newEnd);
        Object.keys(next).forEach((k) => {
          next[k] = { ...next[k], end: newEnd, duration: dur };
        });
        return next;
      });
    } else {
      setDayTimes((prev) => {
        const dur = computeDuration(prev[dayV].start, newEnd);
        return { ...prev, [dayV]: { ...prev[dayV], end: newEnd, duration: dur } };
      });
    }
  };

  const handleDurationChange = (dayV, newDur) => {
    const durNum = parseFloat(newDur);
    if (isSyncTime) {
      setDayTimes((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = { ...next[k], duration: durNum, end: addHoursToTime(next[k].start, durNum) };
        });
        return next;
      });
    } else {
      setDayTimes((prev) => ({
        ...prev,
        [dayV]: { ...prev[dayV], duration: durNum, end: addHoursToTime(prev[dayV].start, durNum) },
      }));
    }
  };

  /* ── Dynamic Price Calculation ───────────── */
  const priceRange = useMemo(() => {
    if (!courts || courts.length === 0 || days.length === 0) 
      return { budget: 0, min: 0, max: 0 };
      
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const resolvePrice = (prices, chunkStartMin, isWeekend) => {
      for (const p of prices) {
        if (p.isWeekend === isWeekend) {
          const s = toMinutes(p.startTime);
          const e = toMinutes(p.endTime);
          if (s <= chunkStartMin && chunkStartMin < e) return p.price;
        }
      }
      return null;
    };

    const getCourtActivePrices = (court) => {
      const active = new Set();
      for (const dayV of days) {
        const isWeekend = dayV === 0 || dayV === 6;
        const times = dayTimes[dayV];
        if (!times) continue;
        const startMin = toMinutes(times.start);
        const endMin = toMinutes(times.end);
        for (let m = startMin; m < endMin; m += slotDuration) {
          const price = resolvePrice(court.prices || [], m, isWeekend);
          if (price !== null) active.add(price);
        }
      }
      return Array.from(active);
    };

    let minAll = Infinity;
    let maxAll = -Infinity;
    
    const courtMaxPrices = courts.map(c => {
      const active = getCourtActivePrices(c);
      if (active.length === 0) return null;
      const cMax = Math.max(...active);
      const cMin = Math.min(...active);
      
      if (cMin < minAll) minAll = cMin;
      if (cMax > maxAll) maxAll = cMax;
      
      return { id: c.id, maxActivePrice: cMax };
    }).filter(c => c !== null);
    
    if (courtMaxPrices.length === 0) 
      return { budget: 0, min: 0, max: 0 };

    let budget = 0;
    if (courtId) {
      const selectedInfo = courtMaxPrices.find(c => c.id === courtId);
      if (selectedInfo) budget = selectedInfo.maxActivePrice;
      else budget = Math.max(...courtMaxPrices.map(c => c.maxActivePrice)); 
    } else {
      budget = Math.min(...courtMaxPrices.map(c => c.maxActivePrice));
    }
    
    if (minAll === Infinity) minAll = 0;
    if (maxAll === -Infinity) maxAll = 0;

    return {
      budget: budget * slotsPerHour,
      min: minAll * slotsPerHour,
      max: maxAll * slotsPerHour
    };
  }, [courts, courtId, days, dayTimes, slotDuration, slotsPerHour]);

  /* ── 90-day max for end date ────────────── */
  const maxEndDate = useMemo(() => {
    if (!rangeStart) return '';
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [rangeStart]);

  /* ── Build payload ─────────────────────── */
  const schedulePayload = useMemo(() => {
    const selectedTimes = days.map((d) => dayTimes[d]);
    const allSame = selectedTimes.length > 0 && selectedTimes.every(
      (t) => t.start === selectedTimes[0].start && t.end === selectedTimes[0].end
    );

    const base = {
      venueId,
      courtId: courtId || null,
      autoSwitchCourt: courtId ? autoSwitchCourt : false,
      pricePreference: (!courtId || autoSwitchCourt) ? pricePreference : null,
      rangeStart,
      rangeEnd,
      sessionStartTime: dayTimes[days[0]]?.start || '18:00',
      sessionEndTime: dayTimes[days[0]]?.end || '20:00',
      daysOfWeek: days,
    };

    if (!allSame && days.length > 0) {
      base.dailySchedules = days.map((d) => ({
        dayOfWeek: d,
        startTime: dayTimes[d].start,
        endTime: dayTimes[d].end,
      }));
    }

    return base;
  }, [venueId, courtId, autoSwitchCourt, pricePreference, rangeStart, rangeEnd, days, dayTimes]);

  /* ── Preview handler ───────────────────── */
  const handlePreview = async () => {
    setPreviewError('');
    setPreview(null);
    if (!venueId) {
      setPreviewError('Vui lòng chọn cơ sở.');
      return;
    }
    if (!days.length) {
      setPreviewError('Chọn ít nhất một thứ trong tuần.');
      return;
    }
    /* Duration validation */
    const firstDay = days[0];
    const dur = computeDuration(dayTimes[firstDay]?.start, dayTimes[firstDay]?.end);
    if (dur <= 0) {
      setPreviewError('Giờ kết thúc phải lớn hơn giờ bắt đầu. Vui lòng kiểm tra lại khung giờ.');
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await previewLongTermBooking(schedulePayload);

      let finalDiscount = null;
      if (result && result.items && result.items.length > 0) {
        const dStart = new Date(rangeStart);
        const dEnd = new Date(rangeEnd);
        const daysDuration = Math.round(Math.abs(dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;

        try {
          const availItems = (result.items || []).filter(i => !i.isUnavailable);
          // Extract unique booked dates (ISO yyyy-MM-dd) for consecutive-day discount
          const bookedDates = [...new Set(
            availItems.map(i => {
              const st = i.startTime || i.start || '';
              return typeof st === 'string' ? st.split('T')[0] : '';
            }).filter(Boolean)
          )];

          const discountData = await previewDiscount({
            venueId: venueId,
            baseAmount: result.totalAmount,
            daysDuration: daysDuration,
            bookedDates: bookedDates,
            couponCode: ''
          });
          finalDiscount = discountData;
        } catch (err) {
          console.error("Failed to load discount info", err);
        }
      }

      setPreview({ ...result, discountInfo: finalDiscount });
    } catch (e) {
      const msg =
        e.response?.data?.message
        || (typeof e.response?.data === 'string' ? e.response.data : null)
        || e.message
        || 'Không xem trước được.';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ── Next step ─────────────────────────── */
  const handleNext = () => {
    if (!preview?.slotCount) return;
    const availItems = (preview.items || []).filter(i => !i.isUnavailable);
    navigate('/booking/long-term/confirm', {
      state: {
        venueId,
        venueName,
        venueAddress,
        courtId: courtId || null,
        courtName: preview.courtName || courts.find((c) => c.id === courtId)?.name || '',
        rangeStart,
        rangeEnd,
        sessionStartTime: dayTimes[days[0]]?.start || '18:00',
        sessionEndTime: dayTimes[days[0]]?.end || '20:00',
        daysOfWeek: days,
        dailySchedules: schedulePayload.dailySchedules || null,
        autoSwitchCourt: courtId ? autoSwitchCourt : false,
        pricePreference: (!courtId || autoSwitchCourt) ? pricePreference : null,
        slotDuration,
        preview: {
          slotCount: availItems.length,
          sessionCount: preview.sessionCount,
          totalAmount: availItems.reduce((s, i) => s + (i.price || 0), 0),
          discountInfo: preview.discountInfo,
          isFlexible: preview.isFlexible,
          items: availItems,
        },
      },
    });
  };

  /* ── No venue guard ────────────────────── */
  if (!venueId) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <p className="mb-3">Thiếu thông tin cơ sở.</p>
        <Link to="/venues" className="btn btn-primary">Tìm sân</Link>
      </div>
    );
  }

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>
      <LongTermBookingSteps
        currentStep={1}
        scheduleStepPath="/booking/long-term/fixed"
        scheduleStepLabel="Lịch cố định"
        confirmPath="/booking/long-term/confirm"
      />

      <div className="content">
        <div className="container py-4">
          {/* ── Header card ──────────────────── */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="mb-1">Đặt lịch dài hạn</h3>

              {/* Editing mode banner */}
              {isEditing && (
                <div className="alert d-flex align-items-center mt-2 mb-0 py-2 border-0" style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: 8 }}>
                  <i className="feather-edit-2 me-2 fs-5"></i>
                  <span className="small">
                    <strong>Bạn đang chỉnh sửa</strong> cấu hình lịch trước đó. Nhấn <em>"Xem trước giá & khung giờ"</em> để cập nhật kết quả.
                  </span>
                </div>
              )}
              <p className="text-muted mb-0">
                {venueName}
                {venueAddress ? ` — ${venueAddress}` : ''}
              </p>
              <div className="alert alert-light w-100 d-flex align-items-center mt-3 mb-0 py-2 border-0" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                <i className="feather-info me-2 fs-5"></i>
                <span className="small">
                  <strong>Lưu ý:</strong> Đối với lịch dài hạn, thao tác huỷ đơn sẽ áp dụng cho tất cả các buổi. Bạn chỉ cần thanh toán một lần cho tổng số buổi.
                </span>
              </div>
            </div>
          </div>

          {/* ── Discount info ────────────────── */}
          {(venueState.weeklyDiscountPercent > 0 || venueState.monthlyDiscountPercent > 0) && (
            <div className="alert alert-success d-flex flex-column mb-4 border-success bg-white shadow-sm" style={{ borderLeft: '4px solid #198754' }}>
               <div className="d-flex align-items-center mb-1">
                 <i className="feather-star me-2 fs-5 text-success" />
                 <strong className="text-success" style={{ fontSize: '1.05rem' }}>Ưu đãi áp dụng tự động cho đặt lịch dài hạn:</strong>
               </div>
               <div className="ps-4 ms-2 mt-1">
                 {venueState.weeklyDiscountPercent > 0 && (
                   <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.weeklyDiscountPercent}%</strong> khi đặt sân liên tục từ 7 ngày trở lên (mỗi ngày ít nhất 1 khung giờ).</div>
                 )}
                 {venueState.monthlyDiscountPercent > 0 && (
                   <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.monthlyDiscountPercent}%</strong> khi đặt sân liên tục từ 30 ngày trở lên (mỗi ngày ít nhất 1 khung giờ).</div>
                 )}
                 <div className="text-muted small mt-2"><i className="feather-info me-1" /> Lưu ý: Hệ thống chỉ tự động áp dụng 1 mức giảm giá cao nhất phù hợp liền mạch với kỳ hạn đặt sân.</div>
               </div>
            </div>
          )}

          {/* ── Configuration card ───────────── */}
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="border-bottom pb-2">Cấu hình</h5>
              {loadCourts.loading && <p className="text-muted">Đang tải sân…</p>}
              {loadCourts.error && <div className="alert alert-danger">{loadCourts.error}</div>}

              {/* Court + Date range */}
              {/* Court + Date range */}
              <div className="row g-3 mb-2">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Sân</label>
                  <select
                    className="form-select"
                    value={courtId}
                    onChange={(e) => { setCourtId(e.target.value); setAutoSwitchCourt(false); }}
                  >
                    <option value="">🏸 Sân bất kỳ (Tự động sắp xếp)</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {/* Visual hint for "Any Court" */}
                  {!courtId && (
                    <div className="text-muted small mt-1 fst-italic">
                      <i className="feather-info me-1"></i>
                      Hệ thống sẽ tự động gán sân trống phù hợp nhất cho từng buổi để đảm bảo lịch trình được đặt trọn vẹn.
                    </div>
                  )}

                  {/* Auto-switch toggle for specific court */}
                  {courtId && (
                    <div className="form-check mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="autoSwitchCourt"
                        checked={autoSwitchCourt}
                        onChange={(e) => setAutoSwitchCourt(e.target.checked)}
                      />
                      <label className="form-check-label small text-dark" htmlFor="autoSwitchCourt">
                        Cho phép tự động chuyển sang sân khác nếu sân này bị kẹt giờ
                      </label>
                    </div>
                  )}
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Từ ngày</label>
                  <ShuttleDateField
                    value={rangeStart}
                    onChange={handleRangeStartChange}
                    placeholder="dd/mm/yyyy"
                    minDate={todayIso()}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Đến ngày</label>
                  <div className={rangeStart > rangeEnd ? "border border-danger rounded" : ""}>
                    <ShuttleDateField
                      value={rangeEnd}
                      onChange={(ymd) => setRangeEnd(ymd)}
                      placeholder="dd/mm/yyyy"
                      minDate={rangeStart}
                      maxDate={maxEndDate}
                    />
                  </div>
                  {rangeStart > rangeEnd && (
                     <div className="text-danger mt-1" style={{ fontSize: '12px' }}>Ngày kết thúc không được nhỏ hơn ngày bắt đầu.</div>
                  )}
                </div>
              </div>

              {/* Price preference radios (Moved Out of Column) */}
              {(!courtId || autoSwitchCourt) && (
                <div className="mt-2 bg-light border rounded p-3 mb-4">
                  <div className="d-flex flex-column gap-3">
                    <label className="form-check mb-0">
                      <input className="form-check-input" type="radio" name="pricePref" value="BUDGET"
                        checked={pricePreference === 'BUDGET'} onChange={() => setPricePreference('BUDGET')} />
                      <span className="form-check-label fw-medium text-dark d-block">
                        💰 {courtId ? 'Cố định mức giá' : 'Tiết kiệm'} (Tối đa: {priceRange.budget > 0 ? `${priceRange.budget.toLocaleString('vi-VN')}đ/h` : '...'})
                      </span>
                      <span className="text-muted small ms-4 d-block mt-1 lh-sm">
                        Lịch của bạn sẽ chỉ dùng các sân có mức giá tới {priceRange.budget > 0 ? `${priceRange.budget.toLocaleString('vi-VN')}đ/h` : '...'}. Một số buổi có thể rơi vào trạng thái "Hết sân" nếu hệ thống không tìm được sân có cùng mức giá.
                      </span>
                    </label>
                    <label className="form-check mb-0">
                      <input className="form-check-input" type="radio" name="pricePref" value="BEST"
                        checked={pricePreference === 'BEST'} onChange={() => setPricePreference('BEST')} />
                      <span className="form-check-label fw-medium text-dark d-block">
                        ⚡ Linh hoạt (Sân bất kỳ: {priceRange.min > 0 ? `${priceRange.min.toLocaleString('vi-VN')}đ` : '...'} - {priceRange.max > 0 ? `${priceRange.max.toLocaleString('vi-VN')}đ/h` : '...'})
                      </span>
                      <span className="text-muted small ms-4 d-block mt-1 lh-sm">
                        Hệ thống ưu tiên sân bạn chọn nhưng có thể tự động đổi sang các sân khác (có mức giá tới {priceRange.max > 0 ? `${priceRange.max.toLocaleString('vi-VN')}đ/h` : '...'}) để đảm bảo xếp kín 100% lịch đặt.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── AVAILABILITY SECTION ──────── */}
              <h5 className="border-bottom pb-2 mb-3">Chọn ngày & khung giờ</h5>

              {/* Select Days */}
              <div className="avail-days d-flex flex-wrap gap-2">
                {DAY_OPTS.map(({ v, label }) => (
                  <div className="avail-days__item" key={v}>
                    <input
                      type="checkbox"
                      id={`day_${v}`}
                      checked={days.includes(v)}
                      onChange={() => toggleDay(v)}
                    />
                    <label htmlFor={`day_${v}`}>{label}</label>
                  </div>
                ))}
              </div>

              {/* Sync Toggle */}
              <div className="avail-sync-row">
                <label className="avail-toggle">
                  <input
                    type="checkbox"
                    checked={isSyncTime}
                    onChange={() => setIsSyncTime(!isSyncTime)}
                  />
                  <span className="avail-toggle__slider" />
                </label>
                <span className="avail-sync-row__label">
                  Đồng bộ khung giờ cho tất cả các ngày
                </span>
                <span className="avail-sync-row__hint">
                  {isSyncTime ? 'Cấu hình 1 lần áp dụng cho tất cả ngày đã chọn' : 'Mỗi ngày thiết lập khung giờ riêng biệt'}
                </span>
              </div>

              {/* Day / Time Configuration */}
              <div style={{ transition: 'all 0.3s ease-in-out' }}>
                {isSyncTime ? (
                  /* Global Sync Panel */
                  <div className={`card ${days.length === 0 ? 'bg-transparent shadow-none' : 'bg-light border-0 shadow-sm'} mt-3`} style={{ borderRadius: 12, border: days.length === 0 ? '2px dashed #cbd5e1' : undefined }}>
                    <div className="card-body">
                      {days.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="d-inline-flex align-items-center justify-content-center bg-light rounded-circle mb-3" style={{ width: 64, height: 64 }}>
                            <i className="feather-calendar text-muted fs-3"></i>
                          </div>
                          <h6 className="fw-bold text-dark">Khung giờ chung</h6>
                          <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: 300 }}>
                            Vui lòng chọn ít nhất một thứ trong tuần ở bên trên để bắt đầu cấu hình.
                          </p>
                        </div>
                      ) : (
                        <>
                          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                            <i className="feather-clock text-primary"></i> Khung giờ chung
                          </h6>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold text-muted mb-1">Thời lượng <span className="text-danger">*</span></label>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text bg-white border-end-0 text-primary">⏳</span>
                                <select
                                  className="form-select border-start-0"
                                  value={dayTimes[days[0]]?.duration || 2}
                                  onChange={(e) => handleDurationChange(days[0], e.target.value)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {DURATION_OPTS.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold text-muted mb-1">Giờ bắt đầu <span className="text-danger">*</span></label>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text bg-white border-end-0 text-primary"><i className="feather-clock"></i></span>
                                <input
                                  className="form-control border-start-0 px-2"
                                  type="time"
                                  value={dayTimes[days[0]]?.start || '18:00'}
                                  onChange={(e) => handleStartChange(days[0], e.target.value)}
                                  style={{ cursor: 'text' }}
                                />
                              </div>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold text-muted mb-1">Giờ kết thúc (tự động)</label>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text border-end-0 text-muted" style={{ backgroundColor: '#f1f5f9' }}><i className="feather-clock"></i></span>
                                <input
                                  className="form-control border-start-0 px-2 fw-medium text-muted"
                                  type="time"
                                  value={dayTimes[days[0]]?.end || '20:00'}
                                  readOnly
                                  style={{ backgroundColor: '#f1f5f9', pointerEvents: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Individual Days Accordions */
                  <div className="avail-accordion mt-3">
                    {DAY_OPTS.filter(({ v }) => days.includes(v)).map(({ v, full }) => {
                      const isOpen = !!openDays[v];
                      const t = dayTimes[v];
                      return (
                        <div className={`avail-day-item${isOpen ? ' open' : ''}`} key={v}>
                          {/* Header */}
                          <div className="avail-day-header" onClick={() => toggleAccordion(v)}>
                            <div className="avail-day-header__toggle">
                              <label className="avail-toggle" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={days.includes(v)}
                                  onChange={() => toggleDay(v)}
                                />
                                <span className="avail-toggle__slider" />
                              </label>
                            </div>
                            <span className="avail-day-header__title">{full}</span>
                            <span className="avail-day-header__edit">
                              {isOpen ? 'Đóng' : 'Chỉnh sửa'}
                            </span>
                          </div>

                          {/* Body */}
                          {isOpen && (
                            <div className="avail-day-body">
                              <div className="row g-3 px-3 pb-3">
                                <div className="col-md-4">
                                  <label className="form-label small fw-semibold text-muted mb-1">Thời lượng <span className="text-danger">*</span></label>
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0 text-primary">⏳</span>
                                    <select
                                      className="form-select border-start-0"
                                      value={t.duration}
                                      onChange={(e) => handleDurationChange(v, e.target.value)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {DURATION_OPTS.map((d) => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label small fw-semibold text-muted mb-1">Giờ bắt đầu <span className="text-danger">*</span></label>
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0 text-primary"><i className="feather-clock"></i></span>
                                    <input
                                      className="form-control border-start-0 px-2"
                                      type="time"
                                      value={t.start}
                                      onChange={(e) => handleStartChange(v, e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label small fw-semibold text-muted mb-1">Giờ kết thúc (tự động)</label>
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text border-end-0 text-muted" style={{ backgroundColor: '#f1f5f9' }}><i className="feather-clock"></i></span>
                                    <input
                                      className="form-control border-start-0 px-2 fw-medium text-muted"
                                      type="time"
                                      value={t.end}
                                      readOnly
                                      style={{ backgroundColor: '#f1f5f9', pointerEvents: 'none' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {days.length === 0 && !isSyncTime && (
                <p className="text-muted small mt-2">Chọn ít nhất một ngày để cấu hình giờ.</p>
              )}

              {/* Action buttons */}
              <div className="mt-4 d-flex align-items-center flex-wrap gap-2">
                <button
                  type="button"
                  className={preview ? "btn btn-outline-secondary" : "btn btn-primary px-4"}
                  disabled={previewLoading || days.length === 0 || rangeStart > rangeEnd || !rangeStart || !rangeEnd}
                  onClick={handlePreview}
                >
                  {previewLoading ? 'Đang tính…' : 'Xem trước giá & khung giờ'}
                </button>
                <div className="d-flex gap-2 ms-auto">
                  <button type="button" className="btn btn-outline-danger" onClick={handleClearAll}>
                    <i className="feather-trash-2 me-1" /> Làm mới
                  </button>
                  <Link to="/venues" className="btn btn-light">Quay lại</Link>
                </div>
              </div>
              {previewError && <div className="alert alert-warning mt-3 mb-0">{previewError}</div>}
            </div>
          </div>

          {/* ── Preview results ───────────────── */}
          {preview && (() => {
            const allItems = preview.items || [];
            const availItems = allItems.filter(i => !i.isUnavailable);
            const unavailCount = allItems.filter(i => i.isUnavailable).length;
            const availTotal = availItems.reduce((s, i) => s + (i.price || 0), 0);
            const hasAnyStatusInfo = allItems.some(i => i.isUnavailable || i.isSwitched);

            const diPrev = preview.discountInfo;
            const pLt = Number(diPrev?.longTermDiscountAmount ?? 0);
            const pCp = Number(diPrev?.couponDiscountAmount ?? 0);
            const pLeg = Number(diPrev?.discountAmount ?? 0);
            const previewLongTermLine =
              pLt > 0 ? pLt : (pCp === 0 && pLeg > 0 ? pLeg : 0);
            const previewHasDiscount = previewLongTermLine > 0 || pCp > 0;

            const slotMins = slotDuration;
            const totalMins = availItems.length * slotMins;
            const tH = Math.floor(totalMins / 60);
            const tM = totalMins % 60;
            const totalHoursStr = tM > 0 ? `${tH}h${tM}` : `${tH}h`;

            const sortedItems = [...allItems].sort((a, b) => {
              let aVal = a[sortConfig.key];
              let bVal = b[sortConfig.key];

              if (sortConfig.key === 'courtName') {
                aVal = a.courtName || '\uFFFF'; 
                bVal = b.courtName || '\uFFFF';
              } else if (sortConfig.key === 'status') {
                const getPriority = (item) => {
                  if (item.isUnavailable) return 1;
                  if (item.isSwitched) return 2;
                  return 3;
                };
                aVal = getPriority(a);
                bVal = getPriority(b);
              } else if (sortConfig.key === 'startTime') {
                aVal = new Date(a.startTime).getTime();
                bVal = new Date(b.startTime).getTime();
              } else if (sortConfig.key === 'price') {
                aVal = a.price || 0;
                bVal = b.price || 0;
              }

              if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
            });

            const handleSort = (key) => {
              setSortConfig(prev => ({
                key,
                direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
              }));
            };

            const renderSortIcon = (key) => {
              if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ms-1 text-muted opacity-50" />;
              return sortConfig.direction === 'asc' 
                ? <ChevronUp size={14} className="ms-1 text-primary" /> 
                : <ChevronDown size={14} className="ms-1 text-primary" />;
            };

            return (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="border-bottom pb-2">Kết quả xem trước</h5>
                <p>
                  <strong>{preview.sessionCount}</strong> buổi ·{' '}
                  <strong>{availItems.length}</strong> ô × {slotLabel(slotDuration)}
                  <span className="text-muted ms-2">({totalHoursStr})</span>
                  {unavailCount > 0 && (
                    <span className="text-danger ms-2">(×{unavailCount} hết sân)</span>
                  )}
                </p>

                <div className="bg-light p-3 rounded mb-3 border">
                   <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Tổng phụ (chưa giảm):</span>
                      <span className={previewHasDiscount ? "text-decoration-line-through text-muted" : "fw-bold"}>
                        {Number(availTotal).toLocaleString('vi-VN')} đ
                      </span>
                   </div>

                   {previewLongTermLine > 0 && (
                     <div className="d-flex justify-content-between mb-2">
                        <span className="text-success"><i className="feather-tag me-1" /> Giảm giá đợt dài hạn:</span>
                        <span className="text-success fw-bold">
                          - {previewLongTermLine.toLocaleString('vi-VN')} đ
                        </span>
                     </div>
                   )}
                   {pCp > 0 && (
                     <div className="d-flex justify-content-between mb-2">
                        <span className="text-success"><i className="feather-gift me-1" /> Giảm giá voucher:</span>
                        <span className="text-success fw-bold">
                          - {pCp.toLocaleString('vi-VN')} đ
                        </span>
                     </div>
                   )}

                   <div className="d-flex justify-content-between border-top pt-2 mt-2">
                      <span className="fw-bold">Thành tiền:</span>
                      <span className="fw-bold text-success fs-5">
                        {Number(diPrev?.finalAmount || availTotal).toLocaleString('vi-VN')} đ
                      </span>
                   </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table table-sm table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s' }} onClick={() => handleSort('courtName')} 
                            className={sortConfig.key === 'courtName' ? 'text-primary' : ''}>
                          <div className="d-flex align-items-center">Sân {renderSortIcon('courtName')}</div>
                        </th>
                        <th style={{ cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s' }} onClick={() => handleSort('startTime')}
                            className={sortConfig.key === 'startTime' ? 'text-primary' : ''}>
                          <div className="d-flex align-items-center">Bắt đầu {renderSortIcon('startTime')}</div>
                        </th>
                        <th className="text-muted">Kết thúc</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s' }} onClick={() => handleSort('price')}
                            className={sortConfig.key === 'price' ? 'text-primary' : ''}>
                          <div className="d-flex align-items-center justify-content-end">Giá ({slotLabel(slotDuration)}) {renderSortIcon('price')}</div>
                        </th>
                        {hasAnyStatusInfo && (
                          <th style={{ cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s' }} onClick={() => handleSort('status')}
                              className={sortConfig.key === 'status' ? 'text-primary' : ''}>
                            <div className="d-flex align-items-center">Trạng thái {renderSortIcon('status')}</div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.slice(0, 120).map((row, i) => {
                        if (row.isUnavailable) {
                          return (
                            <tr key={i} style={{ background: '#fff5f5', opacity: 0.7 }}>
                              <td className="text-muted">—</td>
                              <td className="text-muted text-decoration-line-through">{row.startTime ? new Date(row.startTime).toLocaleString('vi-VN') : ''}</td>
                              <td className="text-muted text-decoration-line-through">{row.endTime ? new Date(row.endTime).toLocaleString('vi-VN') : ''}</td>
                              <td className="text-end text-muted">—</td>
                              {hasAnyStatusInfo && (
                                <td>
                                  <span className="badge bg-danger">✖ Hết sân</span>
                                  {row.switchReason && (
                                    <div className="text-warning small mt-1" style={{ fontSize: '11px' }}>
                                      💡 {row.switchReason}
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        }
                        return (
                          <tr key={i} style={row.isSwitched ? { background: '#fffbeb' } : {}}>
                            <td className="fw-semibold">
                              {row.courtName || '—'}
                              {row.isSwitched && (
                                <span className="badge bg-warning text-dark ms-1" title={row.switchReason || 'Đổi sân tự động'}>🔄</span>
                              )}
                            </td>
                            <td>{row.startTime ? new Date(row.startTime).toLocaleString('vi-VN') : ''}</td>
                            <td>{row.endTime ? new Date(row.endTime).toLocaleString('vi-VN') : ''}</td>
                            <td className="text-end">{Number(row.price).toLocaleString('vi-VN')}</td>
                            {hasAnyStatusInfo && (
                              <td>
                                {row.isSwitched
                                  ? <span className="badge bg-warning text-dark">Đổi sân</span>
                                  : <span className="d-inline-flex align-items-center gap-1 text-success" style={{ fontSize: 12 }}><i className="feather-check-circle" style={{ fontSize: 13 }} /> Sẵn sàng</span>
                                }
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {allItems.length > 120 && (
                  <p className="small text-muted mb-0">Chỉ hiển thị 120 dòng đầu.</p>
                )}
                <div ref={previewRef}>
                  <button
                    type="button"
                    className="btn btn-success btn-lg fw-bold w-100 mt-4 py-3 shadow-sm"
                    disabled={availItems.length === 0}
                    onClick={handleNext}
                  >
                    {availItems.length === 0
                      ? 'Không có buổi nào khả dụng'
                      : unavailCount > 0
                        ? `Tiếp theo — Đặt ${availItems.length}/${allItems.length} buổi`
                        : 'Tiếp theo — Xác nhận & thanh toán'
                    }
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── Sticky CTA Bar ──────────────────── */}
          {preview && showStickyCta && (() => {
            const availItems = (preview.items || []).filter(i => !i.isUnavailable);
            if (availItems.length === 0) return null;
            const diPrev = preview.discountInfo;
            const finalAmt = Number(diPrev?.finalAmount || availItems.reduce((s, i) => s + (i.price || 0), 0));
            return (
              <div className="lt-sticky-cta">
                <div className="container d-flex align-items-center justify-content-between gap-3 py-2">
                  <div className="d-flex align-items-center gap-3 text-white">
                    <span className="fw-bold fs-5">{finalAmt.toLocaleString('vi-VN')} đ</span>
                    <span className="opacity-75">·</span>
                    <span className="opacity-90">{preview.sessionCount} buổi · {availItems.length} ô</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-light fw-bold px-4 py-2 text-success"
                    onClick={handleNext}
                    style={{ borderRadius: 8, fontSize: '0.95rem' }}
                  >
                    Tiếp theo — Xác nhận & thanh toán →
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

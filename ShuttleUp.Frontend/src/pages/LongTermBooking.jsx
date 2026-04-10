import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { getVenueCourts, previewLongTermBooking, previewDiscount } from '../api/bookingApi';

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

const DURATION_OPTS = [
  { value: 0.5, label: '30 phút' },
  { value: 1,   label: '1 tiếng' },
  { value: 1.5, label: '1.5 tiếng' },
  { value: 2,   label: '2 tiếng' },
  { value: 2.5, label: '2.5 tiếng' },
  { value: 3,   label: '3 tiếng' },
  { value: 3.5, label: '3.5 tiếng' },
  { value: 4,   label: '4 tiếng' },
];

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

  /* ── Courts ────────────────────────────── */
  const [courts, setCourts] = useState([]);
  const [loadCourts, setLoadCourts] = useState({ loading: false, error: '' });
  const [courtId, setCourtId] = useState('');

  /* ── Date range ────────────────────────── */
  const [rangeStart, setRangeStart] = useState(todayIso());
  const [rangeEnd, setRangeEnd] = useState(todayIso());

  /* ── Days selection ────────────────────── */
  const [days, setDays] = useState(() => [1, 3, 5]);

  /* ── Sync toggle ───────────────────────── */
  const [isSyncTime, setIsSyncTime] = useState(true);

  /* ── Per-day time config ────────────────── */
  const defaultTime = { start: '18:00', end: '20:00', duration: 2 };
  const [dayTimes, setDayTimes] = useState(() => {
    const init = {};
    DAY_OPTS.forEach(d => { init[d.v] = { ...defaultTime }; });
    return init;
  });

  /* ── Accordion open state ──────────────── */
  const [openDays, setOpenDays] = useState({});

  /* ── Preview ───────────────────────────── */
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

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

  /* ── Build payload ─────────────────────── */
  const schedulePayload = useMemo(() => {
    // Check if all selected days share same time (sync mode or naturally same)
    const selectedTimes = days.map((d) => dayTimes[d]);
    const allSame = selectedTimes.length > 0 && selectedTimes.every(
      (t) => t.start === selectedTimes[0].start && t.end === selectedTimes[0].end
    );

    const base = {
      venueId,
      courtId,
      rangeStart,
      rangeEnd,
      sessionStartTime: dayTimes[days[0]]?.start || '18:00',
      sessionEndTime: dayTimes[days[0]]?.end || '20:00',
      daysOfWeek: days,
    };

    if (!allSame && days.length > 0) {
      // Per-day schedules
      base.dailySchedules = days.map((d) => ({
        dayOfWeek: d,
        startTime: dayTimes[d].start,
        endTime: dayTimes[d].end,
      }));
    }

    return base;
  }, [venueId, courtId, rangeStart, rangeEnd, days, dayTimes]);

  /* ── Preview handler ───────────────────── */
  const handlePreview = async () => {
    setPreviewError('');
    setPreview(null);
    if (!venueId || !courtId) {
      setPreviewError('Vui lòng chọn cơ sở và sân.');
      return;
    }
    if (!days.length) {
      setPreviewError('Chọn ít nhất một thứ trong tuần.');
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
          const discountData = await previewDiscount({
            venueId: venueId,
            baseAmount: result.totalAmount,
            daysDuration: daysDuration,
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
    navigate('/booking/long-term/confirm', {
      state: {
        venueId,
        venueName,
        venueAddress,
        courtId,
        courtName: courts.find((c) => c.id === courtId)?.name ?? '',
        rangeStart,
        rangeEnd,
        sessionStartTime: dayTimes[days[0]]?.start || '18:00',
        sessionEndTime: dayTimes[days[0]]?.end || '20:00',
        daysOfWeek: days,
        dailySchedules: schedulePayload.dailySchedules || null,
        preview: {
          slotCount: preview.slotCount,
          sessionCount: preview.sessionCount,
          totalAmount: preview.totalAmount,
          discountInfo: preview.discountInfo,
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
              <p className="text-muted mb-0">
                {venueName}
                {venueAddress ? ` — ${venueAddress}` : ''}
              </p>
              <p className="small text-danger mt-2 mb-0">
                Huỷ đơn sẽ huỷ toàn bộ các buổi trong chuỗi; thanh toán một lần cho tổng tiền.
              </p>
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
                   <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.weeklyDiscountPercent}%</strong> khi ngày bắt đầu và kết thúc cách nhau từ 7 ngày trở lên.</div>
                 )}
                 {venueState.monthlyDiscountPercent > 0 && (
                   <div className="mb-1"><i className="feather-check-circle me-1 text-success small" /> Giảm <strong>{venueState.monthlyDiscountPercent}%</strong> khi ngày bắt đầu và kết thúc cách nhau từ 30 ngày trở lên.</div>
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
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Sân</label>
                  <select
                    className="form-select"
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                  >
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Từ ngày</label>
                  <input
                    type="date"
                    className="form-control"
                    value={rangeStart}
                    min={todayIso()}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Đến ngày</label>
                  <input
                    type="date"
                    className="form-control"
                    value={rangeEnd}
                    min={rangeStart}
                    onChange={(e) => setRangeEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* ── AVAILABILITY SECTION ──────── */}
              <h5 className="border-bottom pb-2 mb-3">Chọn ngày & khung giờ</h5>

              {/* Select Days */}
              <div className="avail-days">
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
                  {isSyncTime ? 'Thay đổi 1 ngày sẽ áp dụng cho tất cả' : 'Mỗi ngày có thể đặt giờ riêng'}
                </span>
              </div>

              {/* Days Accordion */}
              <div className="avail-accordion">
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
                          <div className="avail-time-row">
                            {/* Duration */}
                            <div className="avail-time-field">
                              <label>Thời lượng <span>*</span></label>
                              <select
                                value={t.duration}
                                onChange={(e) => handleDurationChange(v, e.target.value)}
                              >
                                {DURATION_OPTS.map((d) => (
                                  <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                              </select>
                            </div>
                            {/* Start Time */}
                            <div className="avail-time-field">
                              <label>Giờ bắt đầu <span>*</span></label>
                              <input
                                type="time"
                                value={t.start}
                                onChange={(e) => handleStartChange(v, e.target.value)}
                              />
                            </div>
                            {/* End Time */}
                            <div className="avail-time-field">
                              <label>Giờ kết thúc <span>*</span></label>
                              <input
                                type="time"
                                value={t.end}
                                onChange={(e) => handleEndChange(v, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {days.length === 0 && (
                <p className="text-muted small mt-2">Chọn ít nhất một ngày để cấu hình giờ.</p>
              )}

              {/* Action buttons */}
              <div className="mt-4 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={previewLoading || !courtId}
                  onClick={handlePreview}
                >
                  {previewLoading ? 'Đang tính…' : 'Xem trước giá & khung giờ'}
                </button>
                <Link to="/venues" className="btn btn-outline-secondary">Quay lại</Link>
              </div>
              {previewError && <div className="alert alert-warning mt-3 mb-0">{previewError}</div>}
            </div>
          </div>

          {/* ── Preview results ───────────────── */}
          {preview && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="border-bottom pb-2">Kết quả xem trước</h5>
                <p>
                  <strong>{preview.sessionCount}</strong> buổi ·{' '}
                  <strong>{preview.slotCount}</strong> ô × 30 phút
                </p>

                <div className="bg-light p-3 rounded mb-3 border">
                   <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Tổng phụ (chưa giảm):</span>
                      <span className={preview.discountInfo?.discountAmount > 0 ? "text-decoration-line-through text-muted" : "fw-bold"}>
                        {Number(preview.totalAmount).toLocaleString('vi-VN')} đ
                      </span>
                   </div>

                   {preview.discountInfo?.discountAmount > 0 && (
                     <div className="d-flex justify-content-between mb-2">
                        <span className="text-success"><i className="feather-tag me-1" /> Giảm giá đặt dài hạn:</span>
                        <span className="text-success fw-bold">
                          - {Number(preview.discountInfo.discountAmount).toLocaleString('vi-VN')} đ
                        </span>
                     </div>
                   )}

                   <div className="d-flex justify-content-between border-top pt-2 mt-2">
                      <span className="fw-bold">Thành tiền:</span>
                      <span className="fw-bold text-success fs-5">
                        {Number(preview.discountInfo?.finalAmount || preview.totalAmount).toLocaleString('vi-VN')} đ
                      </span>
                   </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '320px' }}>
                  <table className="table table-sm table-bordered">
                    <thead>
                      <tr>
                        <th>Bắt đầu</th>
                        <th>Kết thúc</th>
                        <th className="text-end">Giá (30p)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.items || []).slice(0, 80).map((row, i) => (
                        <tr key={i}>
                          <td>{row.startTime ? new Date(row.startTime).toLocaleString('vi-VN') : ''}</td>
                          <td>{row.endTime ? new Date(row.endTime).toLocaleString('vi-VN') : ''}</td>
                          <td className="text-end">{Number(row.price).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(preview.items || []).length > 80 && (
                  <p className="small text-muted mb-0">Chỉ hiển thị 80 dòng đầu.</p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary mt-3"
                  onClick={handleNext}
                >
                  Tiếp theo — xác nhận thông tin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

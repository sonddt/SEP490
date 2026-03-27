import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { getVenueCourts, previewLongTermBooking } from '../api/bookingApi';

const DAY_OPTS = [
  { v: 0, label: 'CN' },
  { v: 1, label: 'T2' },
  { v: 2, label: 'T3' },
  { v: 3, label: 'T4' },
  { v: 4, label: 'T5' },
  { v: 5, label: 'T6' },
  { v: 6, label: 'T7' },
];

function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function LongTermBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const venueState = location.state ?? {};

  const venueId = venueState.venueId ?? null;
  const venueName = venueState.venueName ?? 'Cơ sở';
  const venueAddress = venueState.venueAddress ?? '';

  const [courts, setCourts] = useState([]);
  const [loadCourts, setLoadCourts] = useState({ loading: false, error: '' });

  const [courtId, setCourtId] = useState('');
  const [rangeStart, setRangeStart] = useState(todayIso());
  const [rangeEnd, setRangeEnd] = useState(todayIso());
  const [sessionStart, setSessionStart] = useState('18:00');
  const [sessionEnd, setSessionEnd] = useState('20:00');
  const [days, setDays] = useState(() => [1, 3, 5]);

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

  const toggleDay = (v) => {
    setDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const schedulePayload = useMemo(
    () => ({
      venueId,
      courtId,
      rangeStart,
      rangeEnd,
      sessionStartTime: sessionStart,
      sessionEndTime: sessionEnd,
      daysOfWeek: days,
    }),
    [venueId, courtId, rangeStart, rangeEnd, sessionStart, sessionEnd, days],
  );

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
      // axiosClient interceptor returns response.data directly (no nested .data)
      const result = await previewLongTermBooking(schedulePayload);
      setPreview(result);
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
        sessionStartTime: sessionStart,
        sessionEndTime: sessionEnd,
        daysOfWeek: days,
        preview: {
          slotCount: preview.slotCount,
          sessionCount: preview.sessionCount,
          totalAmount: preview.totalAmount,
        },
      },
    });
  };

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
      <LongTermBookingSteps currentStep={1} />

      <div className="content">
        <div className="container py-4">
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

          <div className="card mb-4">
            <div className="card-body">
              <h5 className="border-bottom pb-2">Cấu hình</h5>
              {loadCourts.loading && <p className="text-muted">Đang tải sân…</p>}
              {loadCourts.error && <div className="alert alert-danger">{loadCourts.error}</div>}

              <div className="row g-3">
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
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Giờ bắt đầu</label>
                  <input
                    type="time"
                    className="form-control"
                    value={sessionStart}
                    onChange={(e) => setSessionStart(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Giờ kết thúc</label>
                  <input
                    type="time"
                    className="form-control"
                    value={sessionEnd}
                    onChange={(e) => setSessionEnd(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <span className="form-label fw-semibold d-block mb-2">Các thứ trong tuần</span>
                  <div className="d-flex flex-wrap gap-2">
                    {DAY_OPTS.map(({ v, label }) => (
                      <button
                        key={v}
                        type="button"
                        className={`btn btn-sm ${days.includes(v) ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => toggleDay(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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

          {preview && (
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="border-bottom pb-2">Kết quả xem trước</h5>
                <p>
                  <strong>{preview.sessionCount}</strong> buổi ·{' '}
                  <strong>{preview.slotCount}</strong> ô × 30 phút ·{' '}
                  Tổng: <strong className="text-success">{Number(preview.totalAmount).toLocaleString('vi-VN')} VNĐ</strong>
                </p>
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

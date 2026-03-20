import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

const COURT_TYPES = ['Đơn', 'Đôi', 'Đơn / Đôi'];
const SURFACE_TYPES = ['Gỗ PU', 'Thảm nhựa PVC', 'Xi-măng', 'Thảm cao su'];
const TIME_SLOTS = [];
for (let h = 5; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function SectionHeader({ icon, iconBg, iconColor, title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-3">
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={icon} style={{ color: iconColor, fontSize: 18 }} />
      </div>
      <div>
        <h5 style={{ margin: 0 }}>{title}</h5>
        {subtitle && <span style={{ fontSize: 12, color: '#94a3b8' }}>{subtitle}</span>}
      </div>
    </div>
  );
}

export default function ManagerAddCourt() {
  const { venueId, courtId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    courtName: '', courtType: 'Đơn / Đôi', surface: 'Gỗ PU',
    pricePerHour: '', priceWeekend: '', pricePeakHour: '',
    peakHourStart: '17:00', peakHourEnd: '21:00',
    enablePeakPricing: false, maxGuests: 4, description: '',
  });
  const [availability, setAvailability] = useState(
    DAYS.map(() => ({ enabled: true, open: '06:00', close: '22:00' }))
  );
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImageUrls, setExistingImageUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const updateDay = (i, key, val) => setAvailability((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d));
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Chọn ảnh mới thì coi như replace gallery => bỏ ảnh cũ để tránh hiểu nhầm.
    setExistingImageUrls([]);
    setImageFiles((prev) => [...prev, ...files]);
  };
  const removeImage = (i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!courtId) return;
      try {
        setLoading(true);
        const res = await axiosClient.get(`/manager/venues/${venueId}/courts/${courtId}`);
        if (!mounted) return;

        const name = res?.name ?? res?.Name ?? '';
        const sportType = res?.sportType ?? res?.SportType ?? '';
        const surface = res?.surface ?? res?.Surface ?? '';
        const maxGuest = res?.maxGuest ?? res?.MaxGuest ?? res?.maxGuests ?? res?.MaxGuests ?? '';
        const description = res?.description ?? res?.Description ?? '';
        const priceSlots = res?.priceSlots ?? res?.PriceSlots ?? [];
        const openHours = res?.openHours ?? res?.OpenHours ?? [];
        const images = res?.Images ?? res?.images ?? [];

        // Prefill basic
        setForm((p) => ({
          ...p,
          courtName: name,
          courtType: sportType || p.courtType,
          surface: surface || p.surface,
          maxGuests: maxGuest || p.maxGuests,
          description: description || '',
        }));

        // Prefill images gallery (edit page)
        if (Array.isArray(images)) setExistingImageUrls(images);

        // Prefill open hours
        setAvailability((prev) => {
          const next = [...prev];
          for (const oh of openHours || []) {
            const dayIdx = oh?.dayOfWeek ?? oh?.DayOfWeek;
            if (typeof dayIdx !== 'number') continue;
            const enabled = oh?.enabled ?? oh?.Enabled ?? false;
            const open = oh?.openTime ?? oh?.OpenTime;
            const close = oh?.closeTime ?? oh?.CloseTime;
            if (dayIdx >= 0 && dayIdx < next.length) {
              next[dayIdx] = {
                enabled,
                open: open || next[dayIdx].open,
                close: close || next[dayIdx].close,
              };
            }
          }
          return next;
        });

        // Prefill price + peak pricing (heuristic)
        const getNum = (v) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : null;
        };
        const weekday = (priceSlots || []).filter((s) => {
          const isWeekend = s?.isWeekend ?? s?.IsWeekend ?? false;
          return isWeekend !== true;
        });
        const weekend = (priceSlots || []).filter((s) => {
          const isWeekend = s?.isWeekend ?? s?.IsWeekend ?? false;
          return isWeekend === true;
        });

        const weekdayPrices = weekday.map((s) => getNum(s?.price ?? s?.Price)).filter((n) => n !== null);
        const weekendPrices = weekend.map((s) => getNum(s?.price ?? s?.Price)).filter((n) => n !== null);

        const uniqueWeekday = [...new Set(weekdayPrices)];
        uniqueWeekday.sort((a, b) => a - b);

        const minWeekday = uniqueWeekday.length ? uniqueWeekday[0] : null;
        const maxWeekday = uniqueWeekday.length ? uniqueWeekday[uniqueWeekday.length - 1] : null;

        let enablePeakPricing = false;
        let pricePeakHour = '';
        let peakHourStart = '17:00';
        let peakHourEnd = '21:00';

        if (minWeekday != null && maxWeekday != null && maxWeekday > minWeekday) {
          enablePeakPricing = true;
          pricePeakHour = String(maxWeekday);

          const peakSlots = weekday.filter((s) => {
            const p = getNum(s?.price ?? s?.Price);
            return p === maxWeekday;
          });

          const starts = peakSlots.map((s) => s?.startTime ?? s?.StartTime).filter(Boolean);
          const ends = peakSlots.map((s) => s?.endTime ?? s?.EndTime).filter(Boolean);
          peakHourStart = starts.length ? starts.reduce((a, b) => a < b ? a : b) : peakHourStart;
          peakHourEnd = ends.length ? ends.reduce((a, b) => a > b ? a : b) : peakHourEnd;
        }

        const priceWeekend = weekendPrices.length ? String(Math.min(...weekendPrices)) : '';

        setForm((p) => ({
          ...p,
          courtName: name,
          courtType: sportType || p.courtType,
          surface: surface || p.surface,
          maxGuests: maxGuest || p.maxGuests,
          description: description || '',
          pricePerHour: minWeekday != null ? String(minWeekday) : p.pricePerHour,
          priceWeekend: weekendPrices.length ? String(Math.min(...weekendPrices)) : p.priceWeekend,
          enablePeakPricing,
          pricePeakHour: enablePeakPricing ? String(maxWeekday) : p.pricePeakHour,
          peakHourStart,
          peakHourEnd,
        }));
      } catch (e) {
        console.error('Failed to load court details', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [courtId, venueId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const toNum = (v) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const pricePerHour = toNum(form.pricePerHour);
      const pricePeakHour = toNum(form.pricePeakHour);
      const priceWeekendCommon = toNum(form.priceWeekend);
      const priceWeekend = priceWeekendCommon == null || priceWeekendCommon === 0 ? pricePerHour : priceWeekendCommon;

      const timeToMinutes = (t) => {
        if (!t) return null;
        const [hh, mm] = t.split(':').map((x) => Number(x));
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
        return hh * 60 + mm;
      };

      const priceSlots = [];
      const peakStartMin = timeToMinutes(form.peakHourStart);
      const peakEndMin = timeToMinutes(form.peakHourEnd);

      const pushSlot = (startTime, endTime, price, isWeekend) => {
        if (!startTime || !endTime) return;
        const s = timeToMinutes(startTime);
        const e = timeToMinutes(endTime);
        if (s == null || e == null) return;
        if (s >= e) return;
        priceSlots.push({ startTime, endTime, price, isWeekend });
      };

      if (!form.enablePeakPricing || peakStartMin == null || peakEndMin == null || peakStartMin >= peakEndMin) {
        pushSlot('00:00', '23:59', pricePerHour, false);
        pushSlot('00:00', '23:59', priceWeekend, true);
      } else {
        // Non-peak weekday
        pushSlot('00:00', form.peakHourStart, pricePerHour, false);
        pushSlot(form.peakHourEnd, '23:59', pricePerHour, false);
        // Peak weekday
        pushSlot(form.peakHourStart, form.peakHourEnd, pricePeakHour, false);

        // Non-peak weekend
        pushSlot('00:00', form.peakHourStart, priceWeekend, true);
        pushSlot(form.peakHourEnd, '23:59', priceWeekend, true);
        // Peak weekend
        pushSlot(form.peakHourStart, form.peakHourEnd, pricePeakHour, true);
      }

      const openHours = availability.map((d, i) => ({
        dayOfWeek: i,
        enabled: !!d.enabled,
        openTime: d.enabled ? d.open : null,
        closeTime: d.enabled ? d.close : null,
      }));

      const request = {
        name: form.courtName,
        sportType: form.courtType,
        surface: form.surface,
        maxGuests: toNum(form.maxGuests),
        description: form.description || null,
        isActive: true,
        priceSlots,
        openHours,
      };

      let savedCourtId = courtId;
      if (courtId) {
        await axiosClient.put(`/manager/venues/${venueId}/courts/${courtId}`, request);
      } else {
        const created = await axiosClient.post(`/manager/venues/${venueId}/courts`, request);
        savedCourtId = created?.id ?? created?.Id ?? savedCourtId;
      }

      // Upload gallery images (if any). Backend will replace current court files.
      if (imageFiles?.length > 0 && savedCourtId) {
        const fd = new FormData();
        for (const f of imageFiles) {
          fd.append('imageFiles', f);
        }

        await axiosClient.post(`/manager/venues/${venueId}/courts/${savedCourtId}/files`, fd);
      }

      navigate(`/manager/venues/${venueId}/courts`);
    } catch (err) {
      console.error('Submit court failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="card mb-4">
          <div className="card-header">
            <SectionHeader icon="feather-info" iconBg="#e8f5ee" iconColor="#097E52" title="Thông tin sân" subtitle="Thông tin cơ bản của sân" />
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Tên sân <span className="text-danger">*</span></label>
                <input type="text" className="form-control" placeholder="Ví dụ: Sân 1" value={form.courtName} onChange={(e) => setField('courtName', e.target.value)} required />
              </div>
              <div className="col-md-3">
                <label className="form-label">Loại sân</label>
                <select className="form-select" value={form.courtType} onChange={(e) => setField('courtType', e.target.value)}>
                  {COURT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Mặt sân</label>
                <select className="form-select" value={form.surface} onChange={(e) => setField('surface', e.target.value)}>
                  {SURFACE_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="card mb-4">
          <div className="card-header">
            <SectionHeader icon="feather-dollar-sign" iconBg="#ecfdf5" iconColor="#10b981" title="Giá thuê" subtitle="Cài đặt giá cho từng khung giờ" />
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Giá ngày thường (₫/giờ) <span className="text-danger">*</span></label>
                <input type="number" className="form-control" min={0} placeholder="120000" value={form.pricePerHour} onChange={(e) => setField('pricePerHour', e.target.value)} required />
              </div>
              <div className="col-md-4">
                <label className="form-label">Giá cuối tuần (₫/giờ)</label>
                <input type="number" className="form-control" min={0} placeholder="160000" value={form.priceWeekend} onChange={(e) => setField('priceWeekend', e.target.value)} />
                <small className="text-muted" style={{ marginTop: 4, display: 'block' }}>Để trống nếu dùng giá chung</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Số người tối đa</label>
                <input type="number" className="form-control" min={1} max={20} value={form.maxGuests} onChange={(e) => setField('maxGuests', e.target.value)} />
              </div>

              {/* Peak-hour toggle */}
              <div className="col-12 mt-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => setField('enablePeakPricing', !form.enablePeakPricing)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
                      background: form.enablePeakPricing ? '#097E52' : '#cbd5e1', transition: 'background .2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3, left: form.enablePeakPricing ? 23 : 3,
                      transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: form.enablePeakPricing ? '#097E52' : '#64748b' }}>
                    Bật giá giờ cao điểm
                  </span>
                </label>
              </div>

              {form.enablePeakPricing && (
                <>
                  <div className="col-md-4">
                    <label className="form-label">Giá giờ cao điểm (₫/giờ)</label>
                    <input type="number" className="form-control" min={0} placeholder="180000" value={form.pricePeakHour} onChange={(e) => setField('pricePeakHour', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Bắt đầu cao điểm</label>
                    <select className="form-select" value={form.peakHourStart} onChange={(e) => setField('peakHourStart', e.target.value)}>
                      {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Kết thúc cao điểm</label>
                    <select className="form-select" value={form.peakHourEnd} onChange={(e) => setField('peakHourEnd', e.target.value)}>
                      {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className="card mb-4">
          <div className="card-header">
            <SectionHeader icon="feather-clock" iconBg="#eff6ff" iconColor="#2563eb" title="Lịch hoạt động" subtitle="Thiết lập giờ mở cửa cho từng ngày" />
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20 }}>Ngày</th>
                    <th>Mở cửa</th>
                    <th>Đóng cửa</th>
                    <th>Hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, i) => (
                    <tr key={day} style={{ opacity: availability[i].enabled ? 1 : 0.5, transition: 'opacity .15s' }}>
                      <td style={{ fontWeight: 600, paddingLeft: 20 }}>{day}</td>
                      <td>
                        <select className="form-select" style={{ width: 120, fontSize: 13 }} value={availability[i].open} disabled={!availability[i].enabled} onChange={(e) => updateDay(i, 'open', e.target.value)}>
                          {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-select" style={{ width: 120, fontSize: 13 }} value={availability[i].close} disabled={!availability[i].enabled} onChange={(e) => updateDay(i, 'close', e.target.value)}>
                          {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="mgr-toggle">
                          <div className="status-toggle d-inline-flex align-items-center">
                            <input type="checkbox" id={`day-${i}`} className="check" checked={availability[i].enabled} onChange={(e) => updateDay(i, 'enabled', e.target.checked)} />
                            <label htmlFor={`day-${i}`} className="checktoggle">checkbox</label>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="card mb-4">
          <div className="card-header">
            <SectionHeader icon="feather-file-text" iconBg="#faf5ff" iconColor="#7c3aed" title="Mô tả" subtitle="Thông tin thêm về sân" />
          </div>
          <div className="card-body">
            <textarea className="form-control" rows={4} placeholder="Mô tả thêm về sân (chất lượng, tình trạng mặt sân, ánh sáng, v.v.)" value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
        </div>

        {/* Gallery */}
        <div className="card mb-4">
          <div className="card-header">
            <SectionHeader icon="feather-camera" iconBg="#fef3c7" iconColor="#d97706" title="Hình ảnh" subtitle="Upload ảnh của sân" />
          </div>
          <div className="card-body">
            <div className="mgr-qr-upload" style={{ marginBottom: imageFiles.length > 0 ? 16 : 0 }}>
              <div className="mgr-qr-upload__icon">
                <i className="feather-upload-cloud" />
              </div>
              <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>Tải lên hình ảnh sân</p>
              <small style={{ color: '#94a3b8' }}>PNG, JPG, JPEG – tối đa 5MB/ảnh</small>
              <input type="file" accept="image/*" multiple onChange={handleImageChange} />
            </div>
            {imageFiles.length > 0 ? (
              <div className="d-flex flex-wrap gap-2">
                {imageFiles.map((file, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={URL.createObjectURL(file)} alt=""
                      style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}
                    >
                      <i className="feather-x" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {(existingImageUrls?.length ? existingImageUrls : ['/assets/img/booking/booking-01.jpg']).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={url}
                      alt=""
                      style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="d-flex gap-3 mb-5">
          <button type="submit" className="btn btn-secondary" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> Đang xử lý...</>
            ) : (
              <>{courtId ? <><i className="feather-edit-2" /> Cập nhật sân</> : <><i className="feather-plus-circle" /> Thêm sân</>}</>
            )}
          </button>
          <Link to={`/manager/venues/${venueId}/courts`} className="btn btn-outline-secondary">
            Huỷ
          </Link>
        </div>
      </form>
    </div>
  );
}

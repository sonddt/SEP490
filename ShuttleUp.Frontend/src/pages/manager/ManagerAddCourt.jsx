import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

function SectionHeader({ icon, iconBg, iconColor, title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-4">
      <div style={{ width: 42, height: 42, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={icon} style={{ color: iconColor, fontSize: 20 }} />
      </div>
      <div>
        <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{title}</h5>
        {subtitle && <span style={{ fontSize: 13, color: '#64748b', marginTop: 2, display: 'block' }}>{subtitle}</span>}
      </div>
    </div>
  );
}

export default function ManagerAddCourt() {
  const { venueId, courtId } = useParams();
  const navigate = useNavigate();

  const SURFACE_TYPES = ['Gỗ PU', 'Thảm nhựa PVC', 'Xi-măng', 'Thảm cao su'];
  
  const [form, setForm] = useState({
    name: '',
    code: '',
    surface: 'Gỗ PU',
    maxGuests: 4,
    priceWeekday: '',
    priceWeekend: '',
    peakPricing: false,
    description: ''
  });

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  const TIME_SLOTS = [];
  for (let h = 5; h <= 23; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));

  const [existingImages, setExistingImages] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleDay = (i, key, val) => setDayHours((p) => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  useEffect(() => {
    if (!courtId) return;
    let mounted = true;
    const fetchCourt = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/manager/venues/${venueId}/courts/${courtId}`);
        if (!mounted) return;
        
        const name = res?.name || res?.Name || '';
        const surface = res?.surface || res?.Surface || 'Gỗ PU';
        const maxGuest = res?.maxGuest || res?.MaxGuest || 4;
        
        const priceSlots = res?.priceSlots || res?.PriceSlots || [];
        let pWeek = '', pEnd = '';
        if (priceSlots.length) {
           pWeek = priceSlots.find(p => !p.isWeekend && !p.IsWeekend)?.price || priceSlots[0].price;
           pEnd = priceSlots.find(p => p.isWeekend || p.IsWeekend)?.price || pWeek;
        }
        
        const hours = res?.openHours || res?.OpenHours || [];
        const mappedHours = DAYS.map((_, i) => {
          const matched = hours.find(h => (h.dayOfWeek ?? h.DayOfWeek) === i);
          if (matched && (matched.enabled ?? matched.Enabled)) {
            return { enabled: true, open: matched.openTime || matched.OpenTime || '06:00', close: matched.closeTime || matched.CloseTime || '22:00' };
          }
          return { enabled: false, open: '06:00', close: '22:00' };
        });

        setForm(p => ({
          ...p,
          name,
          surface,
          maxGuests: maxGuest,
          priceWeekday: typeof pWeek === 'number' ? String(pWeek) : '',
          priceWeekend: typeof pEnd === 'number' ? String(pEnd) : '',
          description: res?.description || res?.Description || ''
        }));
        
        setDayHours(mappedHours);
        
        if (res?.Images || res?.images) {
           setExistingImages(res.Images || res.images);
        }
      } catch (err) {
        console.error('Failed to load court', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCourt();
    return () => { mounted = false; };
  }, [courtId, venueId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const priceSlots = [];
      const pw = Number(form.priceWeekday) || 0;
      const pe = Number(form.priceWeekend) || pw;
      
      priceSlots.push({ startTime: '05:00', endTime: '23:59', price: pw, isWeekend: false });
      priceSlots.push({ startTime: '05:00', endTime: '23:59', price: pe, isWeekend: true });
      
      const openHours = dayHours.map((d, i) => ({
        dayOfWeek: i,
        enabled: d.enabled,
        openTime: d.enabled ? d.open : null,
        closeTime: d.enabled ? d.close : null
      }));

      const request = {
        name: form.name,
        surface: form.surface,
        maxGuests: Number(form.maxGuests),
        description: form.description,
        status: "ACTIVE", // based on new BE plan
        isActive: true,
        priceSlots,
        openHours
      };

      let savedCourtId = courtId;
      if (courtId) {
        await axiosClient.put(`/manager/venues/${venueId}/courts/${courtId}`, request);
      } else {
        const created = await axiosClient.post(`/manager/venues/${venueId}/courts`, request);
        savedCourtId = created?.id || created?.Id;
      }

      if (newImageFiles.length > 0 && savedCourtId) {
        const fd = new FormData();
        for (const file of newImageFiles) {
          fd.append('imageFiles', file);
        }
        await axiosClient.post(`/manager/venues/${venueId}/courts/${savedCourtId}/files`, fd);
      }

      navigate(`/manager/venues/${venueId}/courts`);
    } catch (err) {
      console.error('Submit court failed', err);
      alert(err.response?.data?.message || err.response?.data?.title || 'Đã xảy ra lỗi khi lưu Sân. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0 px-md-3 pb-5">
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4 border-bottom pb-4">
        <button onClick={() => navigate(`/manager/venues/${venueId}/courts`)} className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <i className="feather-arrow-left fs-5" />
        </button>
        <div>
          <h3 className="mb-0 fw-bold text-dark">{courtId ? 'Cập nhật Sân con' : 'Đăng ký Sân con'}</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Thiết lập thông tin, giá và lịch trống riêng cho sân này</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row g-4">

          {/* ================= LEFT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
            {/* Basic Info */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-target" iconBg="#e8f5ee" iconColor="#097E52" title="1. Đặc tả sân đấu" subtitle="Định dạng tên, mã nội bộ và tiêu chuẩn mặt sân" />
                
                <div className="row g-4">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Tên hiển thị <span className="text-danger">*</span></label>
                    <input type="text" className="form-control form-control-lg bg-light border-0" placeholder="Ví dụ: Sân số 1" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Mã quản lý nội bộ</label>
                    <input type="text" className="form-control form-control-lg bg-light border-0" placeholder="Ví dụ: B1" value={form.code} onChange={(e) => setField('code', e.target.value)} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Loại mặt thảm</label>
                    <select className="form-select form-select-lg bg-light border-0" value={form.surface} onChange={(e) => setField('surface', e.target.value)}>
                      {SURFACE_TYPES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Khuyến cáo số người tối đa</label>
                    <input type="number" min={1} max={20} className="form-control form-control-lg bg-light border-0" placeholder="4" value={form.maxGuests} onChange={(e) => setField('maxGuests', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-dollar-sign" iconBg="#fff3cd" iconColor="#d97706" title="2. Quy định biểu giá" subtitle="Bảng giá thuê sân mặc định tính theo đơn vị giờ" />
                
                <div className="row g-4 align-items-end">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Giá ngày thường <span className="text-danger">*</span></label>
                    <div className="input-group input-group-lg">
                      <input type="number" min={0} className="form-control bg-light border-0" placeholder="100000" value={form.priceWeekday} onChange={(e) => setField('priceWeekday', e.target.value)} required />
                      <span className="input-group-text bg-light border-0 text-muted">đ/giờ</span>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Giá cuối tuần (T7, CN)</label>
                    <div className="input-group input-group-lg">
                      <input type="number" min={0} className="form-control bg-light border-0" placeholder="120000" value={form.priceWeekend} onChange={(e) => setField('priceWeekend', e.target.value)} />
                      <span className="input-group-text bg-light border-0 text-muted">đ/giờ</span>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="form-check form-switch pt-2" style={{ transform: 'scale(1.1)', transformOrigin: 'left center' }}>
                      <input className="form-check-input" type="checkbox" id="peakToggleCourt" checked={form.peakPricing} onChange={(e) => setField('peakPricing', e.target.checked)} />
                      <label className="form-check-label ms-2 fw-medium text-dark" htmlFor="peakToggleCourt">Mở khóa phụ thu theo khung Giờ Vàng (Cao điểm)</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
            {/* Schedule */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-calendar" iconBg="#e0e7ff" iconColor="#4f46e5" title="3. Khung giờ nhận khách" subtitle="Tự động hủy đặt sân đối với những giờ đóng cửa" />
                
                <div className="px-2">
                  {DAYS.map((day, i) => (
                    <div key={day} className="row align-items-center py-3 border-bottom" style={{ opacity: dayHours[i].enabled ? 1 : 0.6, transition: '0.2s' }}>
                      <div className="col-3 col-sm-2 fw-bold text-dark">{day}</div>
                      
                      <div className="col-3 col-sm-4 px-1">
                        <select className="form-select form-select-sm bg-light border-0" value={dayHours[i].open} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'open', e.target.value)}>
                          {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                        </select>
                      </div>
                      
                      <div className="col-3 col-sm-4 px-1">
                        <select className="form-select form-select-sm bg-light border-0" value={dayHours[i].close} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'close', e.target.value)}>
                          {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                        </select>
                      </div>

                      <div className="col-3 col-sm-2 text-end">
                        <div className="form-check form-switch d-inline-block m-0" style={{ transform: 'scale(1.1)' }}>
                          <input className="form-check-input m-0 cursor-pointer" type="checkbox" checked={dayHours[i].enabled} onChange={(e) => toggleDay(i, 'enabled', e.target.checked)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-image" iconBg="#fce7f3" iconColor="#db2777" title="4. Bộ sưu tập ảnh" subtitle="Góc chụp thực tế sân đấu (tối đa 5 ảnh)" />
                
                <div className="bg-light rounded-4 p-4 border" style={{ borderStyle: 'dashed !important', minHeight: 220 }}>
                  <input type="file" multiple className="d-none" id="galleryUpload" accept="image/*" onChange={(e) => setNewImageFiles(p => [...p, ...Array.from(e.target.files || [])])} />
                  
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    {/* Existing Images */}
                    {existingImages.map((src, i) => (
                      <div key={'ex_'+i} className="position-relative rounded-3 overflow-hidden shadow-sm border" style={{ width: 84, height: 84 }}>
                        <img src={src} alt="gal" className="w-100 h-100 object-fit-cover" />
                      </div>
                    ))}
                    
                    {/* New Images */}
                    {newImageFiles.map((file, i) => (
                      <div key={'new_'+i} className="position-relative rounded-3 overflow-hidden shadow-sm" style={{ width: 84, height: 84 }}>
                        <img src={URL.createObjectURL(file)} alt="gal" className="w-100 h-100 object-fit-cover" />
                        <div className="position-absolute top-0 end-0 p-1">
                          <button type="button" className="btn btn-sm btn-danger p-0 d-flex align-items-center justify-content-center shadow" style={{ width: 20, height: 20, borderRadius: '50%' }} onClick={() => setNewImageFiles(p => p.filter((_, idx) => idx !== i))}>
                            <i className="feather-x" style={{ fontSize: 10 }} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Upload Trigger */}
                    <label htmlFor="galleryUpload" className="d-flex flex-column align-items-center justify-content-center bg-white border border-secondary text-secondary rounded-3 cursor-pointer" style={{ width: 84, height: 84, borderStyle: 'dashed !important' }}>
                      <i className="feather-plus mb-1" style={{ fontSize: 20 }} />
                      <span style={{ fontSize: 11, fontWeight: 500 }}>Upload</span>
                    </label>
                  </div>
                  
                  {(existingImages.length === 0 && newImageFiles.length === 0) && (
                    <div className="text-secondary small mt-3"><i className="feather-info me-1" />Khuyến nghị tải hình ảnh sắc nét, định dạng JPG/PNG.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-3 mt-4 mb-4">
          <Link to={`/manager/venues/${venueId}/courts`} className="btn btn-light fw-bold px-4 py-3 shadow-sm" style={{ borderRadius: 12 }}>
            Hủy bỏ
          </Link>
          <button type="submit" className="btn btn-primary fw-bold px-5 py-3 shadow" disabled={submitting} style={{ borderRadius: 12, background: '#097E52', borderColor: '#097E52' }}>
             {submitting ? 'ĐANG LƯU...' : 'LƯU VÀ XUẤT BẢN'}
          </button>
        </div>

      </form>
    </div>
  );
}

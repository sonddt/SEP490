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

export default function ManagerAddVenue() {
  const { venueId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    address: '',
    contactName: '',
    contactPhone: '',
    lat: '',
    lng: ''
  });
  
  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  const TIME_SLOTS = [];
  for (let h = 5; h <= 23; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));
  
  const [thumbnailFiles, setThumbnailFiles] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const getFieldError = (field) => {
    if (!fieldErrors) return null;
    const key = Object.keys(fieldErrors).find(k => k.toLowerCase() === field.toLowerCase());
    return key ? fieldErrors[key][0] : null;
  };

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleDay = (i, key, val) => setDayHours((p) => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  useEffect(() => {
    if (!venueId) return;
    let mounted = true;
    const fetchVenue = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/venues/${venueId}`);
        if (!mounted) return;
        setForm(p => ({
          ...p,
          name: res?.name || res?.Name || '',
          address: res?.address || res?.Address || '',
          contactName: res?.contactName || res?.ContactName || '',
          contactPhone: res?.contactPhone || res?.ContactPhone || '',
          lat: res?.lat || res?.Lat || '',
          lng: res?.lng || res?.Lng || ''
        }));
      } catch (err) {
        console.error('Failed to load venue', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchVenue();
    return () => { mounted = false; };
  }, [venueId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      setFieldErrors({});
      setSubmitting(true);
      const request = {
        name: form.name,
        address: form.address,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        contactName: form.contactName,
        contactPhone: form.contactPhone
      };

      if (venueId) {
        await axiosClient.put(`/manager/venues/${venueId}`, request);
      } else {
        await axiosClient.post('/manager/venues', request);
      }
      navigate('/manager/venues');
    } catch (err) {
      console.error('Submit venue failed', err);
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setErrorMsg('Vui lòng kiểm tra lại các trường bị lỗi bên dưới.');
      } else {
        setFieldErrors({});
        setErrorMsg(err.response?.data?.message || err.response?.data?.title || 'Đã xảy ra lỗi khi lưu Cụm sân. Vui lòng kiểm tra lại dữ liệu!');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
        <button onClick={() => navigate('/manager/venues')} className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <i className="feather-arrow-left fs-5" />
        </button>
        <div>
          <h3 className="mb-0 fw-bold text-dark">{venueId ? 'Cập nhật Cụm sân' : 'Tạo mới Cụm sân'}</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Thiết lập thông tin chung cho cơ sở của bạn</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center mb-4" style={{ borderRadius: 10, border: 'none', background: '#fef2f2', color: '#991b1b', padding: '14px 20px' }}>
            <i className="feather-alert-circle fs-5 me-2" />
            <span className="fw-medium">{errorMsg}</span>
          </div>
        )}
        <div className="row g-4">
          
          {/* ================= LEFT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
            {/* Basic Info Card */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-map" iconBg="#e8f5ee" iconColor="#097E52" title="1. Thông tin cơ bản" subtitle="Tên, địa chỉ và thông báo liên hệ" />
                
                <div className="row g-4">
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Tên cụm sân <span className="text-danger">*</span></label>
                    <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('name') ? 'is-invalid' : ''}`} placeholder="Ví dụ: ShuttleUp Quận 7" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                    {getFieldError('name') && <div className="invalid-feedback">{getFieldError('name')}</div>}
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Địa chỉ cụ thể <span className="text-danger">*</span></label>
                    <textarea className={`form-control form-control-lg bg-light border-0 ${getFieldError('address') ? 'is-invalid' : ''}`} rows="3" placeholder="Số nhà, đường, phường, quận..." value={form.address} onChange={(e) => setField('address', e.target.value)} required />
                    {getFieldError('address') && <div className="invalid-feedback">{getFieldError('address')}</div>}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Người đại diện</label>
                    <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('contactName') ? 'is-invalid' : ''}`} placeholder="Nguyễn Văn A" value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} />
                    {getFieldError('contactName') && <div className="invalid-feedback">{getFieldError('contactName')}</div>}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Số điện thoại</label>
                    <input type="tel" className={`form-control form-control-lg bg-light border-0 ${getFieldError('contactPhone') ? 'is-invalid' : ''}`} placeholder="0901234567" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} />
                    {getFieldError('contactPhone') && <div className="invalid-feedback">{getFieldError('contactPhone')}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Location / Meta Card */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-map-pin" iconBg="#eff6ff" iconColor="#2563eb" title="2. Tọa độ bản đồ" subtitle="Lấy từ Google Maps (Tùy chọn)" />
                <div className="row g-4">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Vĩ độ (Latitude)</label>
                    <input type="number" step="any" className={`form-control form-control-lg bg-light border-0 ${getFieldError('lat') ? 'is-invalid' : ''}`} placeholder="10.7769" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                    {getFieldError('lat') && <div className="invalid-feedback">{getFieldError('lat')}</div>}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Kinh độ (Longitude)</label>
                    <input type="number" step="any" className={`form-control form-control-lg bg-light border-0 ${getFieldError('lng') ? 'is-invalid' : ''}`} placeholder="106.7009" value={form.lng} onChange={(e) => setField('lng', e.target.value)} />
                    {getFieldError('lng') && <div className="invalid-feedback">{getFieldError('lng')}</div>}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
             {/* Media Card */}
             <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-image" iconBg="#fce7f3" iconColor="#db2777" title="3. Hình ảnh đại diện" subtitle="Tải lên ảnh đẹp nhất để thu hút khách" />
                
                <div className="position-relative bg-light rounded-4 d-flex align-items-center justify-content-center border" style={{ height: 260, borderStyle: 'dashed !important' }}>
                  <input type="file" className="position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => setThumbnailFiles(Array.from(e.target.files || []))} />
                  {thumbnailFiles.length > 0 ? (
                    <img src={URL.createObjectURL(thumbnailFiles[0])} alt="thumb" className="w-100 h-100 rounded-4" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="text-center text-muted">
                      <div className="bg-white shadow-sm d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 64, height: 64 }}>
                         <i className="feather-upload-cloud text-primary" style={{ fontSize: 28 }} />
                      </div>
                      <h6 className="fw-semibold text-dark">Nhấn hoặc Kéo thả ảnh vào đây</h6>
                      <span className="small text-secondary">Hỗ trợ JPG, PNG (Tối đa 5MB)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-clock" iconBg="#fef3c7" iconColor="#d97706" title="4. Lịch hoạt động chung" subtitle="Cài đặt khung giờ làm việc tiêu chuẩn" />
                
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

          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-3 mt-4 mb-4">
          <Link to="/manager/venues" className="btn btn-light fw-bold px-4 py-3 shadow-sm" style={{ borderRadius: 12 }}>
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

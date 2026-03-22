import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

function SectionHeader({ icon, iconBg, iconColor, title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-3">
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={icon} style={{ color: iconColor, fontSize: 18 }} />
      </div>
      <div>
        <h5 style={{ margin: 0, fontWeight: 600 }}>{title}</h5>
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
    lat: '',
    lng: ''
  });
  
  // Fake states preserved for UI consistency on frontend
  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleDay = (i, key, val) => setDayHours((p) => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  useEffect(() => {
    if (!venueId) return;
    let mounted = true;
    const fetchVenue = async () => {
      try {
        setLoading(true);
        // Using public endpoint because manager venue details endpoint might not exist
        const res = await axiosClient.get(`/venues/${venueId}`);
        if (!mounted) return;
        setForm({
          name: res?.name || res?.Name || '',
          address: res?.address || res?.Address || '',
          lat: res?.lat || res?.Lat || '',
          lng: res?.lng || res?.Lng || ''
        });
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
      setSubmitting(true);
      
      const request = {
        name: form.name,
        address: form.address,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null
      };

      if (venueId) {
        await axiosClient.put(`/manager/venues/${venueId}`, request);
      } else {
        await axiosClient.post('/manager/venues', request);
      }

      // Notes: Currently only Name, Address, Lat, Lng are persisted in ManagerVenueUpsertDto. 
      // Hours and Images are mocked here for the venue level. (Handled at Court level usually).

      navigate('/manager/venues');
    } catch (err) {
      console.error('Submit venue failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-border text-secondary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 60 }}>
      {/* Back button & Title */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <button onClick={() => navigate('/manager/venues')} className="btn btn-icon btn-outline-secondary" style={{ width: 40, height: 40, borderRadius: '50%' }}>
          <i className="feather-arrow-left" />
        </button>
        <h4 className="mb-0 fw-bold">{venueId ? 'Cập nhật cụm sân' : 'Thêm cụm sân mới'}</h4>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
          <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
            <SectionHeader icon="feather-map" iconBg="#e8f5ee" iconColor="#097E52" title="Thông tin cơ bản" subtitle="Tên và địa chỉ cụm sân" />
          </div>
          <div className="card-body pt-3 pb-4">
            <div className="row g-4">
              <div className="col-12">
                <label className="form-label fw-medium text-dark">Tên cụm sân <span className="text-danger">*</span></label>
                <input type="text" className="form-control" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} placeholder="Ví dụ: ShuttleUp Quận 7" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium text-dark">Địa chỉ chi tiết <span className="text-danger">*</span></label>
                <input type="text" className="form-control" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..." value={form.address} onChange={(e) => setField('address', e.target.value)} required />
              </div>
            </div>
          </div>
        </div>

        {/* Location (Lat, Lng) */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
          <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
            <SectionHeader icon="feather-map-pin" iconBg="#eff6ff" iconColor="#2563eb" title="Vị trí bản đồ" subtitle="Tọa độ hiển thị Google Maps" />
          </div>
          <div className="card-body pt-3 pb-4">
            <div className="row g-4">
              <div className="col-md-6">
                <label className="form-label fw-medium text-dark">Vĩ độ (Latitude)</label>
                <input type="number" step="any" className="form-control" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} placeholder="Ví dụ: 10.7769" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium text-dark">Kinh độ (Longitude)</label>
                <input type="number" step="any" className="form-control" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} placeholder="Ví dụ: 106.7009" value={form.lng} onChange={(e) => setField('lng', e.target.value)} />
              </div>
              <div className="col-12">
                <div className="rounded-3" style={{ background: '#f1f5f9', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1' }}>
                  <p className="text-muted mb-0 fw-medium d-flex align-items-center"><i className="feather-map-pin me-2" style={{ fontSize: 20 }}></i> Bản đồ sẽ hiển thị tại đây</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mock Description (UI only) */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
          <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
            <SectionHeader icon="feather-align-left" iconBg="#fef3c7" iconColor="#d97706" title="Giới thiệu chung" subtitle="Mô tả bao quát cụm sân" />
          </div>
          <div className="card-body pt-3 pb-4">
            <textarea className="form-control" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} rows={4} placeholder="Mô tả cụm sân, đường đi, thông tin hữu ích..." value={description} onChange={e => setDescription(e.target.value)} />
            <small className="text-muted mt-2 d-block fst-italic">* Chú ý: Backend hiện chỉ hỗ trợ Tên, Địa chỉ và Vị trí tọa độ ở cấp độ Venue. Các trường này chờ cập nhật API.</small>
          </div>
        </div>

        {/* Submit */}
        <div className="d-flex gap-3 mt-4 pt-2">
          <button type="submit" className="btn btn-primary d-inline-flex align-items-center" disabled={submitting} style={{ background: '#097E52', borderColor: '#097E52', fontWeight: 500, padding: '10px 24px' }}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> Đang lưu...</>
            ) : (
              <><i className={venueId ? "feather-save me-2" : "feather-plus-circle me-2"} /> {venueId ? 'Cập nhật cụm sân' : 'Thêm cụm sân'}</>
            )}
          </button>
          <Link to="/manager/venues" className="btn btn-outline-secondary fw-medium" style={{ padding: '10px 24px' }}>
            Huỷ bỏ
          </Link>
        </div>
      </form>
    </div>
  );
}

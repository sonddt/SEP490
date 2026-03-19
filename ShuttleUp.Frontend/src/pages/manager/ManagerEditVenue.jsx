import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const AMENITIES = ['Bãi đỗ xe', 'Nước uống', 'Sơ cứu', 'Phòng thay đồ', 'Nhà tắm', 'WiFi', 'Căn-tin', 'Điều hoà'];
const INCLUDES  = ['Vợt cầu lông (miễn phí)', 'Cầu lông (bao)', 'Thuê vợt', 'Giày thể thao', 'Tủ khoá'];

const MOCK_VENUE = {
  venueName: 'ShuttleUp Quận 7',
  courtCount: 3,
  address: '12 Nguyễn Thị Thập',
  district: 'Quận 7',
  province: 'Hồ Chí Minh',
  pricePerHour: '120000',
  maxGuests: 4,
  overview: 'Cụm sân cầu lông cao cấp tại Quận 7. Sân gỗ PU đạt chuẩn, ánh sáng tốt, có máy lạnh.',
  rules: ['Không hút thuốc', 'Mang giày thể thao', 'Đúng giờ'],
  amenities: ['Bãi đỗ xe', 'Nước uống', 'Phòng thay đồ', 'WiFi', 'Điều hoà'],
  includes: ['Vợt cầu lông (miễn phí)', 'Cầu lông (bao)'],
  lat: '10.7369',
  lng: '106.7222',
  existingImages: [
    '/assets/img/booking/booking-01.jpg',
    '/assets/img/booking/booking-02.jpg',
    '/assets/img/booking/booking-03.jpg',
  ],
  dayHours: DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })),
};

export default function ManagerEditVenue() {
  const { venueId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    venueName: '', courtCount: 1, address: '', district: '', province: 'Hồ Chí Minh',
    pricePerHour: '', maxGuests: 4, overview: '', rules: [], newRule: '',
    amenities: [], includes: [], lat: '', lng: '',
  });
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));
  const [existingImages, setExistingImages] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: fetch venue by venueId from API
    setTimeout(() => {
      setForm({
        venueName: MOCK_VENUE.venueName, courtCount: MOCK_VENUE.courtCount,
        address: MOCK_VENUE.address, district: MOCK_VENUE.district, province: MOCK_VENUE.province,
        pricePerHour: MOCK_VENUE.pricePerHour, maxGuests: MOCK_VENUE.maxGuests,
        overview: MOCK_VENUE.overview, rules: MOCK_VENUE.rules, newRule: '',
        amenities: MOCK_VENUE.amenities, includes: MOCK_VENUE.includes,
        lat: MOCK_VENUE.lat, lng: MOCK_VENUE.lng,
      });
      setDayHours(MOCK_VENUE.dayHours);
      setExistingImages(MOCK_VENUE.existingImages);
      setLoading(false);
    }, 300);
  }, [venueId]);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleDay = (i, key, val) => setDayHours((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d));
  const toggleCheckbox = (key, val) => setField(key, form[key].includes(val) ? form[key].filter((v) => v !== val) : [...form[key], val]);
  const addRule = () => { if (!form.newRule.trim()) return; setField('rules', [...form.rules, form.newRule.trim()]); setField('newRule', ''); };
  const removeRule = (i) => setField('rules', form.rules.filter((_, idx) => idx !== i));
  const removeExistingImage = (i) => setExistingImages((prev) => prev.filter((_, idx) => idx !== i));
  const removeNewImage = (i) => setNewImageFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ venueId, form, dayHours, existingImages, newImageFiles });
    alert('Đã cập nhật thông tin cụm sân thành công!');
    navigate('/manager/courts');
  };

  if (loading) {
    return (
      <div className="main-wrapper content-below-header">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner-border text-secondary" role="status"><span className="visually-hidden">Loading...</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Chỉnh sửa cụm sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/courts">Sân của tôi</Link></li>
            <li>Chỉnh sửa</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          <form onSubmit={handleSubmit}>

            {/* Basic Info */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Thông tin cơ bản</h5></div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Tên cụm sân <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={form.venueName} onChange={(e) => setField('venueName', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Số lượng sân</label>
                    <input type="number" className="form-control" min={1} value={form.courtCount} onChange={(e) => setField('courtCount', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Địa chỉ <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={form.address} onChange={(e) => setField('address', e.target.value)} required />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Quận / Huyện</label>
                    <input type="text" className="form-control" value={form.district} onChange={(e) => setField('district', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Tỉnh / TP</label>
                    <input type="text" className="form-control" value={form.province} onChange={(e) => setField('province', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Giá tiền</h5></div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Giá / giờ (₫) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" min={0} value={form.pricePerHour} onChange={(e) => setField('pricePerHour', e.target.value)} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Số người tối đa / sân</label>
                    <input type="number" className="form-control" min={1} value={form.maxGuests} onChange={(e) => setField('maxGuests', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Giờ hoạt động</h5></div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="thead-light">
                      <tr><th>Ngày</th><th>Mở cửa</th><th>Đóng cửa</th><th>Hoạt động</th></tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day, i) => (
                        <tr key={day} className={!dayHours[i].enabled ? 'table-secondary' : ''}>
                          <td><strong>{day}</strong></td>
                          <td><input type="time" className="form-control" value={dayHours[i].open} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'open', e.target.value)} /></td>
                          <td><input type="time" className="form-control" value={dayHours[i].close} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'close', e.target.value)} /></td>
                          <td>
                            <div className="status-toggle d-inline-flex align-items-center">
                              <input type="checkbox" id={`eday-${i}`} className="check" checked={dayHours[i].enabled} onChange={(e) => toggleDay(i, 'enabled', e.target.checked)} />
                              <label htmlFor={`eday-${i}`} className="checktoggle">checkbox</label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Mô tả</h5></div>
              <div className="card-body">
                <textarea className="form-control" rows={5} value={form.overview} onChange={(e) => setField('overview', e.target.value)} />
              </div>
            </div>

            {/* Includes + Amenities */}
            <div className="row">
              <div className="col-md-6">
                <div className="card mb-4">
                  <div className="card-header"><h5 className="mb-0">Bao gồm</h5></div>
                  <div className="card-body">
                    {INCLUDES.map((item) => (
                      <div key={item} className="form-check mb-2">
                        <input className="form-check-input" type="checkbox" id={`einc-${item}`} checked={form.includes.includes(item)} onChange={() => toggleCheckbox('includes', item)} />
                        <label className="form-check-label" htmlFor={`einc-${item}`}>{item}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card mb-4">
                  <div className="card-header"><h5 className="mb-0">Tiện ích</h5></div>
                  <div className="card-body">
                    {AMENITIES.map((item) => (
                      <div key={item} className="form-check mb-2">
                        <input className="form-check-input" type="checkbox" id={`eam-${item}`} checked={form.amenities.includes(item)} onChange={() => toggleCheckbox('amenities', item)} />
                        <label className="form-check-label" htmlFor={`eam-${item}`}>{item}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Nội quy</h5></div>
              <div className="card-body">
                <div className="d-flex gap-2 mb-2">
                  <input
                    type="text" className="form-control" placeholder="Nhập nội quy"
                    value={form.newRule} onChange={(e) => setField('newRule', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addRule}><i className="feather-plus-circle" /></button>
                </div>
                <ul className="list-unstyled">
                  {form.rules.map((r, i) => (
                    <li key={i} className="d-flex align-items-center gap-2 mb-1">
                      <i className="fa-solid fa-circle-check text-success" />
                      <span className="flex-grow-1">{r}</span>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => removeRule(i)}><i className="feather-trash-2" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Gallery */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Hình ảnh</h5></div>
              <div className="card-body">
                {existingImages.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label text-muted">Ảnh hiện tại</label>
                    <div className="d-flex flex-wrap gap-2">
                      {existingImages.map((src, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                          <button
                            type="button"
                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, padding: 0, lineHeight: 1, cursor: 'pointer' }}
                            onClick={() => removeExistingImage(i)}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="file-upload" style={{ textAlign: 'center', border: '2px dashed #dee2e6', borderRadius: 8, padding: 24, cursor: 'pointer', position: 'relative' }}>
                  <p className="mb-1"><i className="feather-upload me-2" />Thêm ảnh mới</p>
                  <small className="text-muted">PNG, JPG, JPEG</small>
                  <input type="file" accept="image/*" multiple onChange={(e) => setNewImageFiles((prev) => [...prev, ...Array.from(e.target.files)])} style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
                </div>
                {newImageFiles.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {newImageFiles.map((file, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={URL.createObjectURL(file)} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                        <button type="button" style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, padding: 0, lineHeight: 1, cursor: 'pointer' }} onClick={() => removeNewImage(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0">Vị trí</h5></div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Vĩ độ</label>
                    <input type="number" step="any" className="form-control" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Kinh độ</label>
                    <input type="number" step="any" className="form-control" value={form.lng} onChange={(e) => setField('lng', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <div className="rounded" style={{ background: '#e9ecef', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p className="text-muted mb-0"><i className="feather-map-pin me-2" />Google Maps sẽ tích hợp sau</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="d-flex gap-3 mb-5">
              <button type="submit" className="btn btn-secondary d-inline-flex align-items-center">
                <i className="feather-save me-2" />Lưu thay đổi
              </button>
              <Link to="/manager/courts" className="btn btn-outline-secondary">Huỷ</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

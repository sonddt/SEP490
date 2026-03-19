import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const COURT_TYPES = ['Đơn', 'Đôi', 'Đơn / Đôi'];
const SURFACE_TYPES = ['Gỗ PU', 'Thảm nhựa PVC', 'Xi-măng', 'Thảm cao su'];
const TIME_SLOTS = [];
for (let h = 5; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export default function ManagerAddCourt() {
  const { venueId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    courtName: '',
    courtType: 'Đơn / Đôi',
    surface: 'Gỗ PU',
    pricePerHour: '',
    priceWeekend: '',
    pricePeakHour: '',
    peakHourStart: '17:00',
    peakHourEnd: '21:00',
    enablePeakPricing: false,
    maxGuests: 4,
    description: '',
  });

  const [availability, setAvailability] = useState(
    DAYS.map(() => ({ enabled: true, open: '06:00', close: '22:00' }))
  );

  const [imageFiles, setImageFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const updateDay = (i, key, val) =>
    setAvailability((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles((prev) => [...prev, ...files]);
  };

  const removeImage = (i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // TODO: API call
    console.log({ venueId, form, availability, imageFiles });
    setTimeout(() => {
      alert('Đã thêm sân mới thành công!');
      setSubmitting(false);
      navigate(`/manager/venues/${venueId || 'v1'}/courts`);
    }, 500);
  };

  return (
    <>
          <div className="row">
            <div className="col-md-10 mx-auto">
              <form onSubmit={handleSubmit}>

                {/* Basic Info */}
                <div className="card mb-4">
                  <div className="card-header"><h5 className="mb-0">Thông tin sân</h5></div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Tên sân <span className="text-danger">*</span></label>
                        <input
                          type="text" className="form-control"
                          placeholder="Ví dụ: Sân 1"
                          value={form.courtName}
                          onChange={(e) => setField('courtName', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Loại sân</label>
                        <select className="form-control" value={form.courtType} onChange={(e) => setField('courtType', e.target.value)}>
                          {COURT_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Mặt sân</label>
                        <select className="form-control" value={form.surface} onChange={(e) => setField('surface', e.target.value)}>
                          {SURFACE_TYPES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="card mb-4">
                  <div className="card-header"><h5 className="mb-0">Giá thuê</h5></div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label">Giá ngày thường (₫/giờ) <span className="text-danger">*</span></label>
                        <input
                          type="number" className="form-control" min={0}
                          placeholder="120000"
                          value={form.pricePerHour}
                          onChange={(e) => setField('pricePerHour', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Giá cuối tuần (₫/giờ)</label>
                        <input
                          type="number" className="form-control" min={0}
                          placeholder="160000"
                          value={form.priceWeekend}
                          onChange={(e) => setField('priceWeekend', e.target.value)}
                        />
                        <small className="text-muted">Để trống nếu dùng giá chung</small>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Số người tối đa</label>
                        <input
                          type="number" className="form-control" min={1} max={20}
                          value={form.maxGuests}
                          onChange={(e) => setField('maxGuests', e.target.value)}
                        />
                      </div>

                      {/* Peak-hour pricing */}
                      <div className="col-12 mt-2">
                        <div className="form-check">
                          <input
                            className="form-check-input" type="checkbox" id="peakPricing"
                            checked={form.enablePeakPricing}
                            onChange={(e) => setField('enablePeakPricing', e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="peakPricing">
                            Bật giá giờ cao điểm
                          </label>
                        </div>
                      </div>
                      {form.enablePeakPricing && (
                        <>
                          <div className="col-md-4">
                            <label className="form-label">Giá giờ cao điểm (₫/giờ)</label>
                            <input
                              type="number" className="form-control" min={0}
                              placeholder="180000"
                              value={form.pricePeakHour}
                              onChange={(e) => setField('pricePeakHour', e.target.value)}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Bắt đầu cao điểm</label>
                            <select className="form-control" value={form.peakHourStart} onChange={(e) => setField('peakHourStart', e.target.value)}>
                              {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Kết thúc cao điểm</label>
                            <select className="form-control" value={form.peakHourEnd} onChange={(e) => setField('peakHourEnd', e.target.value)}>
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
                  <div className="card-header"><h5 className="mb-0">Lịch hoạt động</h5></div>
                  <div className="card-body">
                    <p className="text-muted mb-3">Thiết lập giờ mở cửa cho từng ngày. Tắt ngày nào để sân không hoạt động ngày đó.</p>
                    <div className="table-responsive">
                      <table className="table table-bordered">
                        <thead className="thead-light">
                          <tr>
                            <th>Ngày</th>
                            <th>Mở cửa</th>
                            <th>Đóng cửa</th>
                            <th>Hoạt động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map((day, i) => (
                            <tr key={day} className={!availability[i].enabled ? 'table-secondary' : ''}>
                              <td><strong>{day}</strong></td>
                              <td>
                                <select
                                  className="form-control"
                                  value={availability[i].open}
                                  disabled={!availability[i].enabled}
                                  onChange={(e) => updateDay(i, 'open', e.target.value)}
                                >
                                  {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-control"
                                  value={availability[i].close}
                                  disabled={!availability[i].enabled}
                                  onChange={(e) => updateDay(i, 'close', e.target.value)}
                                >
                                  {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                                </select>
                              </td>
                              <td>
                                <div className="status-toggle d-inline-flex align-items-center">
                                  <input
                                    type="checkbox" id={`day-${i}`} className="check"
                                    checked={availability[i].enabled}
                                    onChange={(e) => updateDay(i, 'enabled', e.target.checked)}
                                  />
                                  <label htmlFor={`day-${i}`} className="checktoggle">checkbox</label>
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
                  <div className="card-header"><h5 className="mb-0">Mô tả</h5></div>
                  <div className="card-body">
                    <textarea
                      className="form-control" rows={4}
                      placeholder="Mô tả thêm về sân (chất lượng, tình trạng mặt sân, ánh sáng, v.v.)"
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                    />
                  </div>
                </div>

                {/* Gallery */}
                <div className="card mb-4">
                  <div className="card-header"><h5 className="mb-0">Hình ảnh</h5></div>
                  <div className="card-body">
                    <div className="file-upload" style={{ textAlign: 'center', border: '2px dashed #dee2e6', borderRadius: 8, padding: 24, cursor: 'pointer', position: 'relative' }}>
                      <img src="/assets/img/icons/upload-icon.svg" className="img-fluid mb-2" alt="" style={{ width: 40 }} />
                      <p className="mb-1">Tải lên hình ảnh sân</p>
                      <small className="text-muted">PNG, JPG, JPEG – tối đa 5MB/ảnh</small>
                      <input
                        type="file" accept="image/*" multiple
                        onChange={handleImageChange}
                        style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
                      />
                    </div>
                    {imageFiles.length > 0 && (
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        {imageFiles.map((file, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <img
                              src={URL.createObjectURL(file)} alt=""
                              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }}
                            />
                            <button
                              type="button"
                              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', width: 20, height: 20, padding: 0, lineHeight: 1, cursor: 'pointer' }}
                              onClick={() => removeImage(i)}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="d-flex gap-3 mb-5">
                  <button type="submit" className="btn btn-secondary d-inline-flex align-items-center" disabled={submitting}>
                    <i className="feather-plus-circle me-2" />{submitting ? 'Đang xử lý...' : 'Thêm sân'}
                  </button>
                  <Link to={`/manager/venues/${venueId || 'v1'}/courts`} className="btn btn-outline-secondary">
                    Huỷ
                  </Link>
                </div>
              </form>
            </div>
          </div>
    </>
  );
}

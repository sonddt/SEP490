import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const AMENITIES = ['Bãi đỗ xe', 'Nước uống', 'Sơ cứu', 'Phòng thay đồ', 'Nhà tắm', 'WiFi', 'Căn-tin', 'Điều hoà'];
const INCLUDES  = ['Vợt cầu lông (miễn phí)', 'Cầu lông (bao)', 'Thuê vợt', 'Giày thể thao', 'Tủ khoá'];

const DEFAULT_HOURS = { open: '06:00', close: '22:00', enabled: true };

const initialDayHours = () => DAYS.map(() => ({ ...DEFAULT_HOURS }));

export default function ManagerAddVenue() {
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────
  const [form, setForm] = useState({
    venueName: '',
    courtCount: 1,
    address: '',
    district: '',
    province: 'Hồ Chí Minh',
    pricePerHour: '',
    maxGuests: 4,
    overview: '',
    rules: [],
    newRule: '',
    amenities: [],
    includes: [],
    lat: '',
    lng: '',
  });
  const [dayHours, setDayHours] = useState(initialDayHours());
  const [imageFiles, setImageFiles] = useState([]);
  const [openSections, setOpenSections] = useState({
    basicInfo: true, price: true, hours: true,
    overview: true, includes: true, rules: true,
    amenities: true, gallery: true, location: true,
  });

  // ── Helpers ───────────────────────────────────────────────────
  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const toggleSection = (key) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const toggleDay = (i, key, val) =>
    setDayHours((prev) => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  const toggleCheckbox = (key, val) =>
    setField(key, form[key].includes(val)
      ? form[key].filter((v) => v !== val)
      : [...form[key], val]);

  const addRule = () => {
    if (!form.newRule.trim()) return;
    setField('rules', [...form.rules, form.newRule.trim()]);
    setField('newRule', '');
  };
  const removeRule = (i) => setField('rules', form.rules.filter((_, idx) => idx !== i));

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles((prev) => [...prev, ...files]);
  };
  const removeImage = (i) => setImageFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: gọi API submit form
    console.log({ form, dayHours, imageFiles });
    alert('Đã gửi yêu cầu đăng ký sân! Vui lòng chờ Admin xét duyệt.');
    navigate('/manager/courts');
  };

  // ── Section accordion wrapper ─────────────────────────────────
  const Section = ({ id, title, children }) => (
    <div className="accordion-item mb-4" id={id}>
      <h4 className="accordion-header">
        <button
          className={`accordion-button${openSections[id] ? '' : ' collapsed'}`}
          type="button"
          onClick={() => toggleSection(id)}
        >
          {title}
        </button>
      </h4>
      {openSections[id] && (
        <div className="accordion-collapse collapse show">
          <div className="accordion-body">{children}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Đăng ký sân mới</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/courts">Sân của tôi</Link></li>
            <li>Đăng ký sân mới</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          {/* Sticky sub-nav */}
          <div className="white-bg court-sec-new mb-4">
            <ul className="nav court-tabs">
              {[
                ['basicInfo','Thông tin cơ bản'],['price','Giá tiền'],['hours','Giờ hoạt động'],
                ['overview','Mô tả'],['includes','Bao gồm'],['rules','Nội quy'],
                ['amenities','Tiện ích'],['gallery','Hình ảnh'],['location','Vị trí'],
              ].map(([id, label]) => (
                <li key={id} className="nav-item">
                  <a className="nav-link" href={`#${id}`} onClick={(e) => { e.preventDefault(); toggleSection(id); }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="accordion">

              {/* ── Thông tin cơ bản ──────────────────────────── */}
              <Section id="basicInfo" title="Thông tin cơ bản">
                <div className="row">
                  <div className="col-md-6">
                    <div className="input-space">
                      <label className="form-label">Tên cụm sân <span className="text-danger">*</span></label>
                      <input
                        type="text" className="form-control"
                        placeholder="Ví dụ: ShuttleUp Quận 7"
                        value={form.venueName}
                        onChange={(e) => setField('venueName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="input-space">
                      <label className="form-label">Số lượng sân</label>
                      <input
                        type="number" className="form-control" min={1} max={50}
                        value={form.courtCount}
                        onChange={(e) => setField('courtCount', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="input-space">
                      <label className="form-label">Địa chỉ chi tiết <span className="text-danger">*</span></label>
                      <input
                        type="text" className="form-control"
                        placeholder="Số nhà, tên đường"
                        value={form.address}
                        onChange={(e) => setField('address', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="input-space">
                      <label className="form-label">Quận / Huyện</label>
                      <input
                        type="text" className="form-control" placeholder="Quận 7"
                        value={form.district}
                        onChange={(e) => setField('district', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="input-space">
                      <label className="form-label">Tỉnh / Thành phố</label>
                      <select
                        className="form-control select"
                        value={form.province}
                        onChange={(e) => setField('province', e.target.value)}
                      >
                        {[
                          'An Giang','Bà Rịa – Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh',
                          'Bến Tre','Bình Định','Bình Dương','Bình Phước','Bình Thuận','Cà Mau',
                          'Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai',
                          'Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương',
                          'Hải Phòng','Hậu Giang','Hoà Bình','Hưng Yên','Khánh Hoà','Kiên Giang',
                          'Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định',
                          'Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam',
                          'Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh',
                          'Thái Bình','Thái Nguyên','Thanh Hoá','Thừa Thiên – Huế','Tiền Giang',
                          'Hồ Chí Minh','Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
                        ].map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </Section>

              {/* ── Giá tiền ──────────────────────────────────── */}
              <Section id="price" title="Giá tiền">
                <div className="row">
                  <div className="col-md-4">
                    <div className="input-space">
                      <label className="form-label">Giá / giờ (₫) <span className="text-danger">*</span></label>
                      <input
                        type="number" className="form-control" min={0}
                        placeholder="Ví dụ: 120000"
                        value={form.pricePerHour}
                        onChange={(e) => setField('pricePerHour', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="input-space">
                      <label className="form-label">Số người tối đa / sân</label>
                      <input
                        type="number" className="form-control" min={1}
                        value={form.maxGuests}
                        onChange={(e) => setField('maxGuests', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </Section>

              {/* ── Giờ hoạt động ─────────────────────────────── */}
              <Section id="hours" title="Giờ hoạt động">
                <p className="text-muted mb-3">Cài đặt giờ mở/đóng cửa cho từng ngày trong tuần</p>
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
                        <tr key={day} className={!dayHours[i].enabled ? 'table-secondary' : ''}>
                          <td><strong>{day}</strong></td>
                          <td>
                            <input
                              type="time" className="form-control"
                              value={dayHours[i].open}
                              disabled={!dayHours[i].enabled}
                              onChange={(e) => toggleDay(i, 'open', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="time" className="form-control"
                              value={dayHours[i].close}
                              disabled={!dayHours[i].enabled}
                              onChange={(e) => toggleDay(i, 'close', e.target.value)}
                            />
                          </td>
                          <td>
                            <div className="status-toggle d-inline-flex align-items-center">
                              <input
                                type="checkbox" id={`day-${i}`} className="check"
                                checked={dayHours[i].enabled}
                                onChange={(e) => toggleDay(i, 'enabled', e.target.checked)}
                              />
                              <label htmlFor={`day-${i}`} className="checktoggle">checkbox</label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* ── Mô tả ─────────────────────────────────────── */}
              <Section id="overview" title="Mô tả cụm sân">
                <textarea
                  className="form-control" rows={6}
                  placeholder="Mô tả về cụm sân của bạn: vị trí, chất lượng sân, không gian, v.v."
                  value={form.overview}
                  onChange={(e) => setField('overview', e.target.value)}
                />
              </Section>

              {/* ── Bao gồm ───────────────────────────────────── */}
              <Section id="includes" title="Bao gồm">
                <ul className="clearfix">
                  {INCLUDES.map((item) => (
                    <li key={item} style={{ float: 'left', width: '50%', marginBottom: 10 }}>
                      <div className="form-check d-flex align-items-center">
                        <input
                          className="form-check-input" type="checkbox" id={`inc-${item}`}
                          checked={form.includes.includes(item)}
                          onChange={() => toggleCheckbox('includes', item)}
                        />
                        <label className="form-check-label ms-2" htmlFor={`inc-${item}`}>{item}</label>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* ── Nội quy ───────────────────────────────────── */}
              <Section id="rules" title="Nội quy sân">
                <div className="input-space d-flex gap-2">
                  <input
                    type="text" className="form-control"
                    placeholder="Nhập nội quy rồi bấm Thêm"
                    value={form.newRule}
                    onChange={(e) => setField('newRule', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addRule}>
                    <i className="feather-plus-circle"></i>
                  </button>
                </div>
                <ul className="rules-wraper mt-2">
                  {form.rules.map((r, i) => (
                    <li key={i} className="d-flex align-items-center gap-2 mb-1">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span className="flex-grow-1">{r}</span>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => removeRule(i)}>
                        <i className="feather-trash-2"></i>
                      </button>
                    </li>
                  ))}
                  {form.rules.length === 0 && (
                    <li className="text-muted"><em>Chưa có nội quy nào.</em></li>
                  )}
                </ul>
              </Section>

              {/* ── Tiện ích ──────────────────────────────────── */}
              <Section id="amenities" title="Tiện ích">
                <ul className="d-flex flex-wrap" style={{ gap: 12, listStyle: 'none', padding: 0 }}>
                  {AMENITIES.map((item) => (
                    <li key={item}>
                      <div className="form-check d-flex align-items-center">
                        <input
                          className="form-check-input" type="checkbox" id={`am-${item}`}
                          checked={form.amenities.includes(item)}
                          onChange={() => toggleCheckbox('amenities', item)}
                        />
                        <label className="form-check-label ms-2" htmlFor={`am-${item}`}>{item}</label>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* ── Hình ảnh ──────────────────────────────────── */}
              <Section id="gallery" title="Hình ảnh sân">
                <div className="mb-3">
                  <label className="form-label">Ảnh cụm sân (có thể chọn nhiều ảnh)</label>
                  <div className="file-upload" style={{ textAlign: 'center', border: '2px dashed #dee2e6', borderRadius: 8, padding: 24, cursor: 'pointer' }}>
                    <img src="/assets/img/icons/upload-icon.svg" className="img-fluid mb-2" alt="upload" style={{ width: 40 }} />
                    <p className="mb-1">Tải lên hình ảnh cụm sân</p>
                    <small className="text-muted">PNG, JPG, JPEG – tối đa 5MB/ảnh</small>
                    <input
                      type="file" className="image-upload" accept="image/*" multiple
                      onChange={handleImageChange}
                      style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
                {imageFiles.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {imageFiles.map((file, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
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
              </Section>

              {/* ── Vị trí ────────────────────────────────────── */}
              <Section id="location" title="Vị trí (Google Maps)">
                <div className="row">
                  <div className="col-md-6">
                    <div className="input-space">
                      <label className="form-label">Vĩ độ (Latitude)</label>
                      <input
                        type="number" step="any" className="form-control"
                        placeholder="Ví dụ: 10.7769"
                        value={form.lat}
                        onChange={(e) => setField('lat', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="input-space">
                      <label className="form-label">Kinh độ (Longitude)</label>
                      <input
                        type="number" step="any" className="form-control"
                        placeholder="Ví dụ: 106.7009"
                        value={form.lng}
                        onChange={(e) => setField('lng', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="google-maps rounded" style={{ background: '#e9ecef', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p className="text-muted mb-0"><i className="feather-map-pin me-2"></i>Google Maps sẽ tích hợp sau</p>
                    </div>
                  </div>
                </div>
              </Section>

            </div>{/* accordion */}

            {/* Submit */}
            <div className="d-flex gap-3 mt-3 mb-5">
              <button type="submit" className="btn btn-secondary d-inline-flex align-items-center">
                <i className="feather-send me-2"></i> Gửi yêu cầu đăng ký
              </button>
              <button type="reset" className="btn btn-outline-secondary" onClick={() => { setForm({ ...form, venueName:'', address:'', pricePerHour:'', overview:'', rules:[], amenities:[], includes:[], lat:'', lng:'' }); setDayHours(initialDayHours()); setImageFiles([]); }}>
                Đặt lại
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

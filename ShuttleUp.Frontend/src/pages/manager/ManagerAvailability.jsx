import { useState } from 'react';
import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const DAYS = [
  { key: 'mon', label: 'Thứ 2' },
  { key: 'tue', label: 'Thứ 3' },
  { key: 'wed', label: 'Thứ 4' },
  { key: 'thu', label: 'Thứ 5' },
  { key: 'fri', label: 'Thứ 6' },
  { key: 'sat', label: 'Thứ 7' },
  { key: 'sun', label: 'Chủ nhật' },
];

const DEFAULT_DAY = { enabled: true, open: '06:00', close: '22:00', priceWeekday: '', priceWeekend: '' };

export default function ManagerAvailability() {
  const [schedule, setSchedule] = useState(
    Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_DAY, priceWeekend: d.key === 'sat' || d.key === 'sun' ? '' : undefined }]))
  );
  const [expanded, setExpanded] = useState({ mon: true });
  const [saved, setSaved] = useState(false);

  const update = (key, field, val) =>
    setSchedule((p) => ({ ...p, [key]: { ...p[key], [field]: val } }));

  const toggleExpand = (key) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = (e) => {
    e.preventDefault();
    console.log('Saved schedule:', schedule);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Giờ hoạt động &amp; Giá tiền</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/dashboard">Quản lý sân</Link></li>
            <li>Giờ hoạt động</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          <div className="row">
            <div className="col-md-10 mx-auto">

              {saved && (
                <div className="alert alert-success">
                  <i className="feather-check-circle me-2"></i>Đã lưu giờ hoạt động thành công!
                </div>
              )}

              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="mb-1">Cài đặt giờ mở/đóng cửa</h5>
                  <p className="text-muted mb-4">
                    Thiết lập giờ hoạt động và giá theo từng ngày trong tuần.
                    Ngày không hoạt động sẽ không cho phép đặt sân.
                  </p>

                  <form onSubmit={handleSave}>
                    {/* Day accordion */}
                    <div className="accordion" id="availabilityAccordion">
                      {DAYS.map((day) => {
                        const s = schedule[day.key];
                        const isOpen = expanded[day.key];
                        return (
                          <div key={day.key} className="accordion-item mb-3">
                            <h4 className="accordion-header">
                              <button
                                className={`accordion-button${isOpen ? '' : ' collapsed'}`}
                                type="button"
                                onClick={() => toggleExpand(day.key)}
                              >
                                <div className="d-flex align-items-center justify-content-between w-100 me-3">
                                  <span className="fw-semibold">{day.label}</span>
                                  <div className="d-flex align-items-center gap-3">
                                    {s.enabled
                                      ? <span className="badge bg-success">{s.open} – {s.close}</span>
                                      : <span className="badge bg-secondary">Đóng cửa</span>
                                    }
                                    <div
                                      className="status-toggle d-inline-flex align-items-center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox" id={`toggle-${day.key}`} className="check"
                                        checked={s.enabled}
                                        onChange={(e) => update(day.key, 'enabled', e.target.checked)}
                                      />
                                      <label htmlFor={`toggle-${day.key}`} className="checktoggle">checkbox</label>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </h4>

                            {isOpen && (
                              <div className="accordion-collapse collapse show">
                                <div className={`accordion-body${!s.enabled ? ' opacity-50 pe-none' : ''}`}>
                                  <div className="row g-3">
                                    <div className="col-md-3">
                                      <label className="form-label">Giờ mở cửa</label>
                                      <input
                                        type="time" className="form-control"
                                        value={s.open}
                                        onChange={(e) => update(day.key, 'open', e.target.value)}
                                        disabled={!s.enabled}
                                      />
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label">Giờ đóng cửa</label>
                                      <input
                                        type="time" className="form-control"
                                        value={s.close}
                                        onChange={(e) => update(day.key, 'close', e.target.value)}
                                        disabled={!s.enabled}
                                      />
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label">Giá ngày thường (₫/giờ)</label>
                                      <input
                                        type="number" className="form-control" min={0}
                                        placeholder="Ví dụ: 120000"
                                        value={s.priceWeekday}
                                        onChange={(e) => update(day.key, 'priceWeekday', e.target.value)}
                                        disabled={!s.enabled}
                                      />
                                    </div>
                                    <div className="col-md-3">
                                      <label className="form-label">Giá cuối tuần (₫/giờ)</label>
                                      <input
                                        type="number" className="form-control" min={0}
                                        placeholder="Ví dụ: 160000"
                                        value={s.priceWeekend ?? ''}
                                        onChange={(e) => update(day.key, 'priceWeekend', e.target.value)}
                                        disabled={!s.enabled}
                                      />
                                      <small className="text-muted">Để trống nếu dùng giá chung</small>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary preview */}
                    <div className="card bg-light mt-4 mb-4">
                      <div className="card-body">
                        <h6 className="mb-3">Tổng quan giờ hoạt động</h6>
                        <div className="table-responsive">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              {DAYS.map((day) => {
                                const s = schedule[day.key];
                                return (
                                  <tr key={day.key}>
                                    <td style={{ width: 100 }}><strong>{day.label}</strong></td>
                                    <td>
                                      {s.enabled
                                        ? <span className="text-success">{s.open} – {s.close}</span>
                                        : <span className="text-muted">Đóng cửa</span>
                                      }
                                    </td>
                                    <td>
                                      {s.enabled && s.priceWeekday && (
                                        <span className="badge bg-primary bg-opacity-10 text-primary">
                                          {Number(s.priceWeekday).toLocaleString('vi-VN')} ₫/giờ
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex gap-3">
                      <button type="submit" className="btn btn-secondary d-inline-flex align-items-center">
                        <i className="feather-save me-2"></i> Lưu cài đặt
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setSchedule(Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_DAY }])))}
                      >
                        Đặt lại
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

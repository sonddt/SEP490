import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVenueCoupons, createVenueCoupon, updateVenueCoupon, deleteVenueCoupon } from '../../api/managerCouponsApi';
import { toast } from 'react-toastify';
import axiosClient from '../../api/axiosClient';

export default function ManagerCoupons() {
  const { venueId } = useParams();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [venue, setVenue] = useState(null);
  const [defaultDiscountForm, setDefaultDiscountForm] = useState({
    weeklyDiscountPercent: '',
    monthlyDiscountPercent: ''
  });
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: '',
    maxDiscountAmount: '',
    minBookingValue: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    isActive: true
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cpRes, vnRes] = await Promise.all([
        getVenueCoupons(venueId).catch(() => []),
        axiosClient.get(`/venues/${venueId}`).catch(() => null)
      ]);
      setCoupons(cpRes);
      if (vnRes) {
        setVenue(vnRes);
        setDefaultDiscountForm({
          weeklyDiscountPercent: vnRes.weeklyDiscountPercent || vnRes.WeeklyDiscountPercent || '',
          monthlyDiscountPercent: vnRes.monthlyDiscountPercent || vnRes.MonthlyDiscountPercent || ''
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải dữ liệu khuyến mãi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) loadData();
  }, [venueId]);

  const handleSaveDefaultDiscount = async () => {
    if (!venue) return;
    try {
      setSavingDefault(true);
      const request = {
        name: venue.name || venue.Name,
        address: venue.address || venue.Address,
        lat: venue.lat || venue.Lat,
        lng: venue.lng || venue.Lng,
        contactName: venue.contactName || venue.ContactName,
        contactPhone: venue.contactPhone || venue.ContactPhone,
        weeklyDiscountPercent: defaultDiscountForm.weeklyDiscountPercent ? Number(defaultDiscountForm.weeklyDiscountPercent) : null,
        monthlyDiscountPercent: defaultDiscountForm.monthlyDiscountPercent ? Number(defaultDiscountForm.monthlyDiscountPercent) : null
      };

      await axiosClient.put(`/manager/venues/${venueId}`, request);
      toast.success('Đã lưu cấu hình giảm giá mặc định!');
      setIsEditingDefault(false);
      setVenue({ ...venue, ...request });
    } catch (err) {
      console.error('Submit venue failed', err);
      toast.error('Lưu giảm giá thất bại. Vui lòng thử lại.');
    } finally {
      setSavingDefault(false);
    }
  };

  const openAdd = () => {
    setEditingCoupon(null);
    setForm({
      code: '',
      discountType: 'PERCENT',
      discountValue: '',
      maxDiscountAmount: '',
      minBookingValue: '',
      startDate: '',
      endDate: '',
      usageLimit: '',
      isActive: true
    });
    setShowModal(true);
  };

  const openEdit = (cp) => {
    setEditingCoupon(cp);
    setForm({
      code: cp.code || cp.Code || '',
      discountType: cp.discountType || cp.DiscountType || 'PERCENT',
      discountValue: cp.discountValue || cp.DiscountValue || '',
      maxDiscountAmount: cp.maxDiscountAmount || cp.MaxDiscountAmount || '',
      minBookingValue: cp.minBookingValue || cp.MinBookingValue || '',
      startDate: (cp.startDate || cp.StartDate || '').substring(0, 16),
      endDate: (cp.endDate || cp.EndDate || '').substring(0, 16),
      usageLimit: cp.usageLimit || cp.UsageLimit || '',
      isActive: cp.isActive !== undefined ? cp.isActive : cp.IsActive !== undefined ? cp.IsActive : true
    });
    setShowModal(true);
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // --- Client-side validation ---
    const code = form.code.trim();
    if (!code) { setFormError('Mã khuyến mãi không được để trống.'); return; }
    if (code.length < 3) { setFormError('Mã khuyến mãi phải có ít nhất 3 ký tự.'); return; }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) { setFormError('Mã chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới.'); return; }

    const discountVal = Number(form.discountValue);
    if (!form.discountValue || isNaN(discountVal) || discountVal <= 0) {
      setFormError('Mức giảm giá phải là số dương lớn hơn 0.'); return;
    }
    if (form.discountType === 'PERCENT' && discountVal > 100) {
      setFormError('Giảm theo phần trăm không được vượt quá 100%.'); return;
    }

    if (form.maxDiscountAmount && Number(form.maxDiscountAmount) < 0) {
      setFormError('Giảm tối đa không được âm.'); return;
    }
    if (form.minBookingValue && Number(form.minBookingValue) < 0) {
      setFormError('Giá trị đơn tối thiểu không được âm.'); return;
    }

    if (!form.startDate) { setFormError('Vui lòng chọn ngày bắt đầu.'); return; }
    if (!form.endDate) { setFormError('Vui lòng chọn ngày kết thúc.'); return; }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setFormError('Ngày bắt đầu hoặc kết thúc không hợp lệ.'); return;
    }
    if (end <= start) {
      setFormError('Ngày kết thúc phải sau ngày bắt đầu.'); return;
    }

    if (form.usageLimit && (Number(form.usageLimit) <= 0 || !Number.isInteger(Number(form.usageLimit)))) {
      setFormError('Giới hạn lượt dùng phải là số nguyên dương.'); return;
    }

    const payload = {
      code: code,
      discountType: form.discountType,
      discountValue: discountVal,
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      minBookingValue: form.minBookingValue ? Number(form.minBookingValue) : 0,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      isActive: form.isActive
    };

    try {
      setSubmitting(true);
      if (editingCoupon) {
        await updateVenueCoupon(venueId, editingCoupon.id || editingCoupon.Id, payload);
        toast.success('Đã cập nhật mã khuyến mãi!');
      } else {
        await createVenueCoupon(venueId, payload);
        toast.success('Đã thêm mã khuyến mãi!');
      }
      setShowModal(false);
      setFormError('');
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu mã khuyến mãi.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cpId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã khuyến mãi này không?')) return;
    try {
      await deleteVenueCoupon(venueId, cpId);
      toast.success('Đã xóa thành công');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Không thể xóa mã khuyến mãi do đã có dữ liệu liên quan. Vui lòng chuyển trạng thái sang Không hoạt động thay vì xóa.');
    }
  };

  return (
    <div className="container-fluid px-0 px-md-3">
      <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
        <div className="d-flex align-items-center gap-3">
          <Link to={`/manager/venues/${venueId}/courts`} className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <i className="feather-arrow-left fs-5" />
          </Link>
          <div>
            <h3 className="mb-0 fw-bold text-dark">Quản lý Khuyến Mãi (Voucher)</h3>
            <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Tạo và phát hành mã giảm giá cho khách đặt sân</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn btn-primary d-flex align-items-center gap-2 fw-medium shadow" style={{ borderRadius: 10, padding: '10px 20px', background: '#097E52', borderColor: '#097E52' }}>
          <i className="feather-plus-circle" />
          Tạo mã mới
        </button>
      </div>

      <div className="row mb-4">
        <div className="col-12 col-md-8 col-xl-6">
          <div className="card shadow-sm border-0 rounded-4" style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)' }}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 40, height: 40 }}>
                    <i className="feather-clock text-primary fs-5" />
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold text-dark">Giảm giá mặc định (Tự động)</h6>
                    <small className="text-secondary">Giảm giá cho khách đặt sân theo Tuần hoặc Tháng</small>
                  </div>
                </div>
                {!isEditingDefault ? (
                  <button onClick={() => setIsEditingDefault(true)} className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 rounded-pill px-3">
                    <i className="feather-edit-2" /> Thiết lập
                  </button>
                ) : null}
              </div>

              {!isEditingDefault ? (
                <div className="d-flex flex-wrap gap-3 mt-4">
                  <div className="bg-white px-4 py-2 rounded-3 shadow-sm border" style={{ flex: 1, minWidth: 150 }}>
                    <div className="text-muted small mb-1">Giảm khi đặt theo Tuần</div>
                    <div className="fw-bold fs-5 text-primary">{defaultDiscountForm.weeklyDiscountPercent ? `${defaultDiscountForm.weeklyDiscountPercent}%` : '0%'}</div>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-3 shadow-sm border" style={{ flex: 1, minWidth: 150 }}>
                    <div className="text-muted small mb-1">Giảm khi đặt theo Tháng</div>
                    <div className="fw-bold fs-5 text-primary">{defaultDiscountForm.monthlyDiscountPercent ? `${defaultDiscountForm.monthlyDiscountPercent}%` : '0%'}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-white rounded-3 border">
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold text-dark">Giảm giá đặt theo Tuần (%)</label>
                      <input type="number" min="0" max="100" className="form-control" placeholder="VD: 5" value={defaultDiscountForm.weeklyDiscountPercent} onChange={e => setDefaultDiscountForm(p => ({ ...p, weeklyDiscountPercent: e.target.value }))} />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label small fw-semibold text-dark">Giảm giá đặt theo Tháng (%)</label>
                      <input type="number" min="0" max="100" className="form-control" placeholder="VD: 15" value={defaultDiscountForm.monthlyDiscountPercent} onChange={e => setDefaultDiscountForm(p => ({ ...p, monthlyDiscountPercent: e.target.value }))} />
                    </div>
                    <div className="col-12 d-flex gap-2 justify-content-end mt-3">
                      <button className="btn btn-light btn-sm px-3" onClick={() => {
                        setIsEditingDefault(false);
                        setDefaultDiscountForm({
                          weeklyDiscountPercent: venue.weeklyDiscountPercent || venue.WeeklyDiscountPercent || '',
                          monthlyDiscountPercent: venue.monthlyDiscountPercent || venue.MonthlyDiscountPercent || ''
                        });
                      }}>Hủy</button>
                      <button className="btn btn-primary btn-sm px-4" onClick={handleSaveDefaultDiscount} disabled={savingDefault}>
                        {savingDefault ? 'Đang lưu...' : 'Lưu lại'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 rounded-4 mb-4">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light" style={{ height: 60 }}>
                <tr>
                  <th className="ps-4 fw-semibold text-muted text-nowrap" style={{ fontSize: 13 }}>MÃ COUPON</th>
                  <th className="fw-semibold text-muted text-nowrap" style={{ fontSize: 13 }}>LOẠI GIẢM GIÁ</th>
                  <th className="fw-semibold text-muted text-nowrap" style={{ fontSize: 13 }}>THỜI GIAN ÁP DỤNG</th>
                  <th className="fw-semibold text-muted text-nowrap" style={{ fontSize: 13 }}>LƯỢT DÙNG</th>
                  <th className="fw-semibold text-muted text-nowrap" style={{ fontSize: 13 }}>TRẠNG THÁI</th>
                  <th className="text-center fw-semibold text-muted text-nowrap pe-4" style={{ fontSize: 13 }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="p-4 bg-light rounded-circle d-inline-flex mb-3">
                        <i className="feather-percent text-secondary" style={{ fontSize: 32 }} />
                      </div>
                      <h5 className="fw-semibold text-dark">Chưa có mã khuyến mãi</h5>
                      <p className="text-muted">Bạn chưa tạo mã khuyến mãi nào cho cụm sân này.</p>
                      <button onClick={openAdd} className="btn btn-outline-primary fw-medium rounded-3 px-4">Tạo mã đầu tiên</button>
                    </td>
                  </tr>
                ) : (
                  coupons.map((cp) => {
                    const id = cp.id || cp.Id;
                    const code = cp.code || cp.Code;
                    const cType = cp.discountType || cp.DiscountType;
                    const cValue = cp.discountValue || cp.DiscountValue;
                    const maxD = cp.maxDiscountAmount || cp.MaxDiscountAmount;
                    const minB = cp.minBookingValue || cp.MinBookingValue;
                    const start = cp.startDate || cp.StartDate;
                    const end = cp.endDate || cp.EndDate;
                    const used = cp.usedCount || cp.UsedCount || 0;
                    const limit = cp.usageLimit || cp.UsageLimit;
                    const active = cp.isActive !== undefined ? cp.isActive : cp.IsActive;

                    return (
                      <tr key={id}>
                        <td className="ps-4 py-3">
                          <span className="badge bg-dark fs-6 d-inline-flex align-items-center gap-1 px-3 py-2" style={{ letterSpacing: 1 }}>
                            <i className="feather-tag fs-6" /> {code}
                          </span>
                        </td>
                        <td>
                          {cType === 'PERCENT' ? (
                            <div>
                              <div className="fw-bold text-dark">Giảm {cValue}%</div>
                              {maxD > 0 && <small className="text-muted d-block">Tối đa {Number(maxD || 0).toLocaleString()}đ</small>}
                            </div>
                          ) : (
                            <div className="fw-bold text-dark">Giảm {Number(cValue || 0).toLocaleString()}đ</div>
                          )}
                          <small className="text-muted d-block">Đơn tối thiểu {Number(minB || 0).toLocaleString()}đ</small>
                        </td>
                        <td>
                          <div className="text-dark"><i className="feather-calendar me-1 text-muted" /> {new Date(start).toLocaleDateString('vi-VN')}</div>
                          <div className="text-dark mt-1"><i className="feather-calendar me-1 text-muted" /> {new Date(end).toLocaleDateString('vi-VN')}</div>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="fw-bold fs-5 text-primary mb-1">{used}</span>
                            <span className="text-muted small">/{limit ? limit : 'Không giới hạn'}</span>
                          </div>
                        </td>
                        <td>
                          {active ? (
                            <span className="badge bg-success-light text-success fw-medium px-3 py-2 rounded-pill"><i className="feather-check-circle me-1" /> Hoạt động</span>
                          ) : (
                            <span className="badge bg-danger-light text-danger fw-medium px-3 py-2 rounded-pill"><i className="feather-x-circle me-1" /> Tạm ngưng</span>
                          )}
                        </td>
                        <td className="text-center pe-4">
                          <button onClick={() => openEdit(cp)} className="btn btn-sm btn-light btn-icon mx-1 rounded-circle" title="Sửa">
                            <i className="feather-edit-3" />
                          </button>
                          <button onClick={() => handleDelete(id)} className="btn btn-sm btn-light btn-icon text-danger mx-1 rounded-circle" title="Xóa">
                            <i className="feather-trash-2" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Popup for Add/Edit */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-primary-light d-flex align-items-center justify-content-center rounded-3" style={{ width: 48, height: 48 }}>
                    <i className="feather-gift text-primary fs-4" />
                  </div>
                  <div>
                    <h4 className="modal-title fw-bold text-dark mb-1">{editingCoupon ? 'Cập nhật mã khuyến mãi' : 'Tạo mã khuyến mãi'}</h4>
                    <p className="text-secondary small mb-0">Thiết lập điều kiện giảm giá cho khách đặt sân</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4 p-md-5 pt-4">
                  {formError && (
                    <div className="alert alert-danger d-flex align-items-start gap-2 mb-4 rounded-3 shadow-sm" role="alert">
                      <i className="feather-alert-circle mt-1 flex-shrink-0" />
                      <div>
                        <strong>Lỗi:</strong> {formError}
                      </div>
                      <button type="button" className="btn-close ms-auto" onClick={() => setFormError('')} />
                    </div>
                  )}
                  <div className="row g-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Mã Code <span className="text-danger">*</span></label>
                      <input type="text" className="form-control form-control-lg bg-light border-0 text-uppercase" placeholder="VD: SUMMER24" value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} required />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Trạng thái phát hành</label>
                      <select className="form-select form-select-lg bg-light border-0 fw-medium" value={form.isActive} onChange={e => setField('isActive', e.target.value === 'true')}>
                        <option value="true">Đang kích hoạt (Cho phép dùng)</option>
                        <option value="false">Tạm khóa (Ngừng sử dụng)</option>
                      </select>
                    </div>

                    <div className="col-12 border-top pt-4 mt-2">
                       <h6 className="fw-bold mb-3 text-secondary"><i className="feather-disc me-2" />Quy tắc giảm giá</h6>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Loại giảm</label>
                      <select className="form-select bg-light border-0" value={form.discountType} onChange={e => setField('discountType', e.target.value)}>
                        <option value="PERCENT">Theo phần trăm (%)</option>
                        <option value="FIXED">Số tiền cố định (VNĐ)</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Mức giảm <span className="text-danger">*</span></label>
                      <input type="number" className="form-control bg-light border-0" placeholder={form.discountType === 'PERCENT' ? '10' : '50000'} min="1" value={form.discountValue} onChange={e => setField('discountValue', e.target.value)} required />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Giảm tối đa (Tùy chọn)</label>
                      <input type="number" className="form-control bg-light border-0" placeholder="VD: 50000" disabled={form.discountType === 'FIXED'} value={form.maxDiscountAmount} onChange={e => setField('maxDiscountAmount', e.target.value)} />
                      <small className="text-muted d-block mt-1" style={{ fontSize: 11 }}>Chỉ dùng mốc giảm %</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Giá trị đơn tối thiểu (Tùy chọn)</label>
                      <div className="input-group">
                        <input type="number" className="form-control bg-light border-0" placeholder="0" value={form.minBookingValue} onChange={e => setField('minBookingValue', e.target.value)} />
                        <span className="input-group-text bg-light border-0 text-muted">VNĐ</span>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Giới hạn số lần dùng (Tùy chọn)</label>
                      <input type="number" className="form-control bg-light border-0" placeholder="Để trống nếu không giới hạn" min="1" value={form.usageLimit} onChange={e => setField('usageLimit', e.target.value)} />
                    </div>

                    <div className="col-12 border-top pt-4 mt-2">
                       <h6 className="fw-bold mb-3 text-secondary"><i className="feather-clock me-2" />Thời gian triển khai</h6>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Từ ngày <span className="text-danger">*</span></label>
                      <input type="datetime-local" className="form-control bg-light border-0" value={form.startDate} onChange={e => setField('startDate', e.target.value)} required />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Đến ngày <span className="text-danger">*</span></label>
                      <input type="datetime-local" className="form-control bg-light border-0" value={form.endDate} onChange={e => setField('endDate', e.target.value)} required />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0 pb-4 px-4 px-md-5 d-flex gap-3">
                  <button type="button" className="btn btn-light fw-bold px-4 py-2" onClick={() => setShowModal(false)}>Hủy</button>
                  <button type="submit" disabled={submitting} className="btn btn-primary fw-bold px-5 py-2 shadow-sm" style={{ background: '#097E52', borderColor: '#097E52' }}>{submitting ? 'ĐANG LƯU...' : 'LƯU KHUYẾN MÃI'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

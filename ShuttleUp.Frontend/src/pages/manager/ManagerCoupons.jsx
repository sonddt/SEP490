import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { getVenueCoupons, createVenueCoupon, updateVenueCoupon, deleteVenueCoupon } from '../../api/managerCouponsApi';
import { notifySuccess, notifyError } from '../../hooks/useNotification';
import axiosClient from '../../api/axiosClient';
import ShuttleDateField, { ShuttleTimePicker, toYMD } from '../../components/ui/ShuttleDateField';

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

  const [couponToDelete, setCouponToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: '',
    maxDiscountAmount: '',
    minBookingValue: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    isActive: true,
    oneUsePerUser: true
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cpRes, vnRes] = await Promise.all([
        getVenueCoupons(venueId).catch(() => []),
        axiosClient.get(`/manager/venues/${venueId}`).catch(() => null)
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
      notifyError('Không thể tải dữ liệu khuyến mãi.');
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
        description: venue.description || venue.Description,
        includes: venue.includes || venue.Includes,
        rules: venue.rules || venue.Rules,
        amenities: venue.amenities || venue.Amenities,
        slotDuration: venue.slotDuration || venue.SlotDuration || 60,
        weeklyDiscountPercent: defaultDiscountForm.weeklyDiscountPercent ? Number(defaultDiscountForm.weeklyDiscountPercent) : null,
        monthlyDiscountPercent: defaultDiscountForm.monthlyDiscountPercent ? Number(defaultDiscountForm.monthlyDiscountPercent) : null
      };

      await axiosClient.put(`/manager/venues/${venueId}`, request);
      notifySuccess('Đã lưu cấu hình giảm giá mặc định!');
      setIsEditingDefault(false);
      setVenue({ ...venue, ...request });
    } catch (err) {
      console.error('Submit venue failed', err);
      notifyError('Lưu giảm giá thất bại. Vui lòng thử lại.');
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
      isActive: true,
      oneUsePerUser: true
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
      isActive: cp.isActive !== undefined ? cp.isActive : cp.IsActive !== undefined ? cp.IsActive : true,
      oneUsePerUser: cp.oneUsePerUser !== undefined ? cp.oneUsePerUser : cp.OneUsePerUser !== undefined ? cp.OneUsePerUser : true
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
    if (!/^[A-Za-z0-9]+$/.test(code)) { setFormError('Mã chỉ được chứa chữ cái (hoa hoặc thường) và số.'); return; }

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
      isActive: form.isActive,
      oneUsePerUser: form.oneUsePerUser
    };

    try {
      setSubmitting(true);
      if (editingCoupon) {
        await updateVenueCoupon(venueId, editingCoupon.id || editingCoupon.Id, payload);
        notifySuccess('Đã cập nhật mã khuyến mãi!');
      } else {
        await createVenueCoupon(venueId, payload);
        notifySuccess('Đã thêm mã khuyến mãi!');
      }
      setShowModal(false);
      setFormError('');
      loadData();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu mã khuyến mãi.';
      setFormError(msg);
      notifyError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (cp) => {
    setCouponToDelete(cp);
  };

  const executeDelete = async () => {
    if (!couponToDelete) return;
    try {
      setDeleting(true);
      await deleteVenueCoupon(venueId, couponToDelete.id || couponToDelete.Id);
      notifySuccess('Đã xóa thành công');
      setCouponToDelete(null);
      loadData();
    } catch (err) {
      console.error(err);
      notifyError('Không thể xóa mã khuyến mãi do đã có dữ liệu liên quan. Vui lòng chuyển trạng thái sang Không hoạt động thay vì xóa.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container-fluid px-0 px-md-3">

      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link
            to={`/manager/venues/${venueId}/courts`}
            className="d-flex align-items-center justify-content-center"
            style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', flexShrink: 0, textDecoration: 'none', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#097E52'; e.currentTarget.style.color = '#097E52'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
          >
            <i className="feather-arrow-left" style={{ fontSize: 18 }} />
          </Link>
          <div>
            <h3 className="mb-0 fw-bold" style={{ fontSize: 20, color: '#1e293b', letterSpacing: '-.02em' }}>Quản lý Khuyến Mãi</h3>
            <p className="mb-0 mt-1" style={{ fontSize: 13, color: '#64748b' }}>Tạo và phát hành mã giảm giá cho khách đặt sân</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="d-flex align-items-center gap-2 fw-semibold"
          style={{ borderRadius: 10, padding: '9px 20px', background: '#097E52', borderColor: '#097E52', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 10px rgba(9,126,82,.3)', transition: 'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#065f3f'}
          onMouseLeave={e => e.currentTarget.style.background = '#097E52'}
        >
          <i className="feather-plus" style={{ fontSize: 16 }} />
          Tạo mã mới
        </button>
      </div>

      {/* ── Default discount card ── */}
      <div className="row mb-4">
        <div className="col-12 col-lg-8 col-xl-6">
          <div className="rounded-4 p-4" style={{ background: 'linear-gradient(135deg, #f0fdf8 0%, #e8f5ee 100%)', border: '1.5px solid #b6e2cc' }}>
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center justify-content-center rounded-3" style={{ width: 42, height: 42, background: 'rgba(9,126,82,.12)', flexShrink: 0 }}>
                  <i className="feather-repeat" style={{ fontSize: 18, color: '#097E52' }} />
                </div>
                <div>
                  <p className="mb-0 fw-bold" style={{ fontSize: 14, color: '#1e293b' }}>Giảm giá tự động theo kỳ</p>
                  <p className="mb-0" style={{ fontSize: 12, color: '#64748b' }}>Áp dụng khi khách đặt sân theo Tuần hoặc Tháng</p>
                </div>
              </div>
              {!isEditingDefault && (
                <button
                  onClick={() => setIsEditingDefault(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1.5px solid #097E52', background: '#fff', color: '#097E52', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  <i className="feather-edit-2" style={{ fontSize: 13 }} /> Thiết lập
                </button>
              )}
            </div>

            {!isEditingDefault ? (
              <div className="d-flex flex-wrap gap-3 mt-4">
                {[
                  { label: 'Đặt theo Tuần', val: defaultDiscountForm.weeklyDiscountPercent, icon: 'feather-calendar' },
                  { label: 'Đặt theo Tháng', val: defaultDiscountForm.monthlyDiscountPercent, icon: 'feather-clock' },
                ].map(item => (
                  <div key={item.label} className="rounded-3 px-4 py-3" style={{ flex: '1 1 140px', background: '#fff', border: '1px solid #d1f0e0' }}>
                    <p className="mb-1" style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}><i className={`${item.icon} me-1`} />{item.label}</p>
                    <p className="mb-0 fw-bold" style={{ fontSize: 22, color: '#097E52', letterSpacing: '-.02em', lineHeight: 1.2 }}>
                      {item.val ? `${item.val}%` : <span style={{ fontSize: 16, color: '#94a3b8' }}>Chưa đặt</span>}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-3" style={{ background: '#fff', border: '1px solid #d1f0e0' }}>
                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Giảm giá đặt theo Tuần (%)</label>
                    <input type="number" min="0" max="100" className="form-control" style={{ fontSize: 14 }} placeholder="VD: 5" value={defaultDiscountForm.weeklyDiscountPercent} onChange={e => setDefaultDiscountForm(p => ({ ...p, weeklyDiscountPercent: e.target.value }))} />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Giảm giá đặt theo Tháng (%)</label>
                    <input type="number" min="0" max="100" className="form-control" style={{ fontSize: 14 }} placeholder="VD: 15" value={defaultDiscountForm.monthlyDiscountPercent} onChange={e => setDefaultDiscountForm(p => ({ ...p, monthlyDiscountPercent: e.target.value }))} />
                  </div>
                  <div className="col-12 d-flex gap-2 justify-content-end mt-2">
                    <button
                      className="btn btn-light btn-sm px-3 fw-medium"
                      style={{ fontSize: 13 }}
                      onClick={() => {
                        setIsEditingDefault(false);
                        setDefaultDiscountForm({
                          weeklyDiscountPercent: venue?.weeklyDiscountPercent || venue?.WeeklyDiscountPercent || '',
                          monthlyDiscountPercent: venue?.monthlyDiscountPercent || venue?.MonthlyDiscountPercent || ''
                        });
                      }}
                    >Hủy</button>
                    <button
                      className="btn btn-primary btn-sm px-4 fw-semibold"
                      onClick={handleSaveDefaultDiscount}
                      disabled={savingDefault}
                    >
                      {savingDefault ? 'Đang lưu...' : 'Lưu lại'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Coupon table ── */}
      <div className="rounded-4 overflow-hidden mb-4" style={{ border: '1.5px solid #e2e8f0', background: '#fff', boxShadow: '0 2px 12px rgba(15,23,42,.06)' }}>
        {/* table header row */}
        <div className="d-flex align-items-center justify-content-between px-4 py-3" style={{ borderBottom: '1.5px solid #f1f5f9' }}>
          <div>
            <p className="mb-0 fw-bold" style={{ fontSize: 15, color: '#1e293b' }}>Danh sách mã coupon</p>
            <p className="mb-0" style={{ fontSize: 12, color: '#94a3b8' }}>{coupons.length} mã đang được quản lý</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #f1f5f9' }}>
                <th className="ps-4 py-3 text-nowrap" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Mã Coupon</th>
                <th className="py-3 text-nowrap" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Ưu đãi</th>
                <th className="py-3 text-nowrap" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Thời gian</th>
                <th className="py-3 text-nowrap" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Lượt dùng</th>
                <th className="py-3 text-nowrap" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Trạng thái</th>
                <th className="py-3 pe-4 text-nowrap text-center" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#94a3b8', textTransform: 'uppercase', border: 0 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5" style={{ border: 0 }}>
                    <div className="spinner-border" style={{ color: '#097E52' }} role="status"><span className="visually-hidden">Loading...</span></div>
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5" style={{ border: 0 }}>
                    <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 64, height: 64, background: '#f0fdf8' }}>
                      <i className="feather-percent" style={{ fontSize: 28, color: '#097E52', opacity: .6 }} />
                    </div>
                    <h6 className="fw-bold" style={{ color: '#1e293b' }}>Chưa có mã khuyến mãi</h6>
                    <p className="text-muted mb-4" style={{ fontSize: 13 }}>Bạn chưa tạo mã khuyến mãi nào cho cụm sân này.</p>
                    <button
                      onClick={openAdd}
                      className="mgr-btn-lift"
                      style={{ padding: '8px 24px', borderRadius: 8, border: '1.5px solid #097E52', background: '#fff', color: '#097E52', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <i className="feather-plus me-1" />Tạo mã đầu tiên
                    </button>
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
                  const isExhausted = limit && used >= limit;
                  const oneUsePerUser = cp.oneUsePerUser !== undefined ? cp.oneUsePerUser : cp.OneUsePerUser !== undefined ? cp.OneUsePerUser : true;

                  return (
                    <tr key={id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafcfb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Coupon code badge — green */}
                      <td className="ps-4 py-3" style={{ border: 0 }}>
                        <div
                          className="d-inline-flex align-items-center gap-2"
                          style={{ padding: '5px 12px 5px 10px', borderRadius: 8, background: 'linear-gradient(135deg, #e8f5ee 0%, #d1f0e0 100%)', border: '1.5px solid #b6e2cc' }}
                        >
                          <i className="feather-tag" style={{ fontSize: 13, color: '#097E52' }} />
                          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', color: '#065f3f' }}>{code}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, maxWidth: 160 }}>
                          {oneUsePerUser ? '1 lần / tài khoản' : 'Nhiều lần / tài khoản'}
                        </div>
                      </td>

                      {/* Discount info */}
                      <td style={{ border: 0 }}>
                        {cType === 'PERCENT' ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                              Giảm <span style={{ color: '#097E52' }}>{cValue}%</span>
                            </div>
                            {maxD > 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Tối đa {Number(maxD).toLocaleString('vi-VN')}đ</div>}
                          </>
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                            Giảm <span style={{ color: '#097E52' }}>{Number(cValue || 0).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Đơn tối thiểu {Number(minB || 0).toLocaleString('vi-VN')}đ</div>
                      </td>

                      {/* Date range */}
                      <td style={{ border: 0 }}>
                        <div style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <i className="feather-log-in" style={{ fontSize: 12, color: '#097E52' }} />
                          {new Date(start).toLocaleDateString('vi-VN')}
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <i className="feather-log-out" style={{ fontSize: 12, color: '#ef4444' }} />
                          {new Date(end).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      {/* Usage */}
                      <td style={{ border: 0, minWidth: 110 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.02em', color: isExhausted ? '#ef4444' : '#097E52' }}>{used}</span>
                          <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>/ {limit ?? '∞'}</span>
                        </div>
                        {limit && (
                          <div style={{ marginTop: 4, height: 4, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden', width: 80 }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, (used / limit) * 100)}%`, background: isExhausted ? '#ef4444' : '#097E52', transition: 'width .3s' }} />
                          </div>
                        )}
                        {isExhausted && <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginTop: 2, display: 'block' }}>Đã hết lượt</span>}
                      </td>

                      {/* Status */}
                      <td style={{ border: 0 }}>
                        {active ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#e8f5ee', color: '#097E52', border: '1px solid #b6e2cc' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#097E52', flexShrink: 0 }} />Hoạt động
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#fff1f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />Tạm ngưng
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-center pe-4" style={{ border: 0 }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <button
                            onClick={() => openEdit(cp)}
                            title="Sửa"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', transition: 'all .15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf8'; e.currentTarget.style.borderColor = '#097E52'; e.currentTarget.style.color = '#097E52'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(9,126,82,.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                          >
                            <i className="feather-edit-3" style={{ fontSize: 14 }} />
                          </button>
                          <button
                            onClick={() => confirmDelete(cp)}
                            title="Xóa"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#ef4444', cursor: 'pointer', transition: 'all .15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239,68,68,.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                          >
                            <i className="feather-trash-2" style={{ fontSize: 14 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: portal ra body — tránh bị .mgr-topbar (z-index 1030) che do stacking trong .mgr-page */}
      {showModal &&
        createPortal(
          <div
            className="modal fade show d-block mgr-coupon-modal"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mgr-coupon-modal-title"
          >
          <div className="modal-dialog modal-lg" style={{ margin: '1.75rem auto' }}>
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-primary-light d-flex align-items-center justify-content-center rounded-3" style={{ width: 44, height: 44 }}>
                    <i className="feather-gift text-primary" style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <h4 id="mgr-coupon-modal-title" className="modal-title fw-bold text-dark mb-1 mgr-coupon-modal__title">{editingCoupon ? 'Cập nhật mã khuyến mãi' : 'Tạo mã khuyến mãi'}</h4>
                    <p className="text-muted mb-0 mgr-coupon-modal__subtitle">Thiết lập điều kiện giảm giá cho khách đặt sân</p>
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
                      <input
                        type="text"
                        className="form-control bg-light border-0"
                        placeholder="VD: Summer24"
                        value={form.code}
                        onChange={(e) => setField('code', e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Trạng thái phát hành</label>
                      <select className="form-select bg-light border-0" value={form.isActive} onChange={e => setField('isActive', e.target.value === 'true')}>
                        <option value="true">Đang kích hoạt (Cho phép dùng)</option>
                        <option value="false">Tạm khóa (Ngừng sử dụng)</option>
                      </select>
                    </div>

                    <div className="col-12 border-top pt-4 mt-2">
                       <h6 className="mgr-coupon-modal__section-title mb-3"><i className="feather-disc me-2" />Quy tắc giảm giá</h6>
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
                      <small className="text-muted d-block mt-1 mgr-coupon-modal__hint">Chỉ dùng khi giảm theo %</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Giá trị đơn tối thiểu (Tùy chọn)</label>
                      <div className="input-group">
                        <input type="number" className="form-control bg-light border-0" placeholder="0" value={form.minBookingValue} onChange={e => setField('minBookingValue', e.target.value)} />
                        <span className="input-group-text bg-light border-0 text-muted mgr-coupon-modal__suffix">VNĐ</span>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Giới hạn số lần dùng (Tùy chọn)</label>
                      <input
                        type="number"
                        className="form-control bg-light border-0"
                        placeholder="Để trống nếu không giới hạn"
                        min="1"
                        value={form.usageLimit}
                        onChange={e => setField('usageLimit', e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <div className="form-check rounded-3 px-3 py-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="mgr-coupon-one-use-per-user"
                          checked={form.oneUsePerUser}
                          onChange={(e) => setField('oneUsePerUser', e.target.checked)}
                        />
                        <label className="form-check-label fw-semibold" htmlFor="mgr-coupon-one-use-per-user" style={{ fontSize: 13, color: '#334155' }}>
                          Mỗi tài khoản chỉ được dùng mã này một lần
                        </label>
                        <p className="mb-0 mt-1 small text-muted" style={{ paddingLeft: '1.5rem', fontSize: 12 }}>
                          Bật để tránh một người dùng lặp lại mã. Đơn đã huỷ không tính — khách có thể dùng lại sau khi huỷ.
                        </p>
                      </div>
                    </div>

                    <div className="col-12 border-top pt-4 mt-2">
                      <h6 className="mgr-coupon-modal__section-title mb-2"><i className="feather-clock me-2" />Thời gian triển khai</h6>
                      <p className="text-muted mb-3 mgr-coupon-modal__lead">Chọn ngày và khung giờ áp dụng cho mã khuyến mãi.</p>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Ngày bắt đầu <span className="text-danger">*</span></label>
                      <ShuttleDateField
                        value={form.startDate ? form.startDate.substring(0, 10) : ''}
                        onChange={(ymd) => {
                          const time = form.startDate.length > 10 ? form.startDate.substring(10) : 'T00:00';
                          setField('startDate', (ymd || '') + (ymd ? time : ''));
                        }}
                        placeholder="dd/mm/yyyy"
                      />
                      <ShuttleTimePicker
                        hourValue={form.startDate ? (form.startDate.substring(11, 13) || '00') : '00'}
                        minuteValue={form.startDate ? (form.startDate.substring(14, 16) || '00') : '00'}
                        onHourChange={(h) => {
                          let datePart = form.startDate.substring(0, 10) || '';
                          if (!datePart) datePart = toYMD(new Date());
                          const min = form.startDate.substring(14, 16) || '00';
                          setField('startDate', datePart + 'T' + h + ':' + min);
                        }}
                        onMinuteChange={(m) => {
                          let datePart = form.startDate.substring(0, 10) || '';
                          if (!datePart) datePart = toYMD(new Date());
                          const hr = form.startDate.substring(11, 13) || '00';
                          setField('startDate', datePart + 'T' + hr + ':' + m);
                        }}
                        minuteOptions={['00', '15', '30', '45']}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Ngày kết thúc <span className="text-danger">*</span></label>
                      <ShuttleDateField
                        value={form.endDate ? form.endDate.substring(0, 10) : ''}
                        onChange={(ymd) => {
                          const time = form.endDate.length > 10 ? form.endDate.substring(10) : 'T23:59';
                          setField('endDate', (ymd || '') + (ymd ? time : ''));
                        }}
                        placeholder="dd/mm/yyyy"
                      />
                      <ShuttleTimePicker
                        hourValue={form.endDate ? (form.endDate.substring(11, 13) || '23') : '23'}
                        minuteValue={form.endDate ? (form.endDate.substring(14, 16) || '59') : '59'}
                        onHourChange={(h) => {
                          let datePart = form.endDate.substring(0, 10) || '';
                          if (!datePart) datePart = toYMD(new Date());
                          const min = form.endDate.substring(14, 16) || '59';
                          setField('endDate', datePart + 'T' + h + ':' + min);
                        }}
                        onMinuteChange={(m) => {
                          let datePart = form.endDate.substring(0, 10) || '';
                          if (!datePart) datePart = toYMD(new Date());
                          const hr = form.endDate.substring(11, 13) || '23';
                          setField('endDate', datePart + 'T' + hr + ':' + m);
                        }}
                        minuteOptions={['00', '15', '30', '45', '59']}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0 pb-4 px-4 px-md-5 d-flex gap-3">
                  <button type="button" className="btn btn-light fw-bold px-4 py-2" onClick={() => setShowModal(false)}>Hủy</button>
                  <button type="submit" disabled={submitting} className="btn btn-primary fw-bold px-5 py-2 shadow-sm">{submitting ? 'ĐANG LƯU...' : 'LƯU KHUYẾN MÃI'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {couponToDelete &&
        createPortal(
          <div
            className="modal fade show d-block mgr-coupon-modal"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
            role="dialog"
          >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 400 }}>
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 24, overflow: 'hidden' }}>
                <div className="p-4 text-center">
                  <div className="mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff1f2' }}>
                    <i className="feather-trash-2" style={{ fontSize: 28, color: '#ef4444' }} />
                  </div>
                  <h5 className="fw-bold mb-2" style={{ color: '#1e293b' }}>Xóa mã khuyến mãi?</h5>
                  <p className="mb-4" style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                    Bạn có chắc chắn muốn xóa mã <strong style={{ color: '#1e293b' }}>{couponToDelete.code || couponToDelete.Code}</strong> không? Hành động này không thể hoàn tác.
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn w-50 fw-semibold"
                      style={{ background: '#f1f5f9', color: '#475569', borderRadius: 12, padding: '12px 0', fontSize: 14 }}
                      onClick={() => setCouponToDelete(null)}
                      disabled={deleting}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn w-50 fw-semibold"
                      style={{ background: '#ef4444', color: '#fff', borderRadius: 12, padding: '12px 0', fontSize: 14 }}
                      onClick={executeDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Đang xóa...' : 'Xóa ngay'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

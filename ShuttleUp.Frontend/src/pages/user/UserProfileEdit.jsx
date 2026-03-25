import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';

const PROVINCES = [
  'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh',
  'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận',
  'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên',
  'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam',
  'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hoà Bình', 'Hưng Yên',
  'Khánh Hoà', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng',
  'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An',
  'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng',
  'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hoá',
  'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

function formatApiError(e, fallback) {
  const d = e?.response?.data;
  if (!d) return fallback;
  if (typeof d.message === 'string' && d.message.trim()) return d.message;
  if (d.errors && typeof d.errors === 'object') {
    const parts = Object.values(d.errors).flat().filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  if (typeof d.title === 'string' && d.title.trim()) return d.title;
  if (typeof d.detail === 'string' && d.detail.trim()) return d.detail;
  return fallback;
}

export default function UserProfileEdit() {
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const { user: authUser, updateUser } = useAuth();
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    about: '',
    address: '',
    district: '',
    province: '',
  });
  const [initialForm, setInitialForm] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleReset = () => {
    if (initialForm) setForm(initialForm);
    setAvatarPreview(currentAvatarUrl);
    setAvatarFile(null);
    setSuccess('');
    setError('');
    setFieldErrors({});
  };

  const VN_PHONE_REGEX = /^0[35789][0-9]{8}$/;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setSuccess('');
        setError('');
        const data = await profileApi.getMe();
        if (!mounted) return;
        const u = data?.user || {};

        const loaded = {
          fullName: u.fullName || '',
          phoneNumber: u.phoneNumber || '',
          gender: u.gender || '',
          dateOfBirth: u.dateOfBirth || '',
          about: u.about || '',
          address: u.address || '',
          district: u.district || '',
          province: u.province || '',
        };

        setForm(loaded);
        setInitialForm(loaded);
        setCurrentAvatarUrl(u.avatarUrl || null);
        setAvatarPreview(u.avatarUrl || null);
        setAvatarFile(null);
      } catch (e) {
        if (!mounted) return;
        setError(formatApiError(e, 'Oops... Không tải được hồ sơ của bạn.'));
        const fallback = {
          fullName: authUser?.fullName || '',
          phoneNumber: authUser?.phoneNumber || '',
          gender: '',
          dateOfBirth: '',
          about: '',
          address: '',
          district: '',
          province: '',
        };
        setForm(fallback);
        setInitialForm(fallback);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    const newErrors = {};

    const fullName = (form.fullName || '').trim();
    if (!fullName) {
      newErrors.fullName = 'Bạn nhớ điền họ và tên nhé!';
    }

    const cleanedPhone = (form.phoneNumber || '').trim();
    if (cleanedPhone) {
      const withoutSpaces = cleanedPhone.replace(/\s+/g, '');
      // Cho phép hoặc số VN 0xxxxxxxxx, hoặc dạng +84xxxxxxxxx
      const isValid = VN_PHONE_REGEX.test(withoutSpaces) || /^\+84\d{9,10}$/.test(withoutSpaces);
      if (!isValid) {
        newErrors.phoneNumber = 'Số điện thoại chưa hợp lệ, bạn kiểm tra lại nhé!';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      await profileApi.updateMe({
        fullName,
        phoneNumber: cleanedPhone || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        about: form.about || null,
        address: form.address || null,
        district: form.district || null,
        province: form.province || null,
      });

      try {
        updateUser({
          fullName,
          phoneNumber: cleanedPhone || undefined,
        });
      } catch {
        /* ignore */
      }

      if (avatarFile) {
        const uploadRes = await profileApi.uploadAvatar(avatarFile);
        const nextAvatarUrl = uploadRes?.avatarUrl || null;
        setCurrentAvatarUrl(nextAvatarUrl);
        setAvatarPreview(nextAvatarUrl);

        // Cập nhật AuthContext + localStorage để các nơi render header/dropdown đổi avatar ngay.
        try {
          updateUser({ avatarUrl: nextAvatarUrl });
        } catch {}
      }

      const nextForm = {
        ...form,
        fullName,
      };
      setInitialForm(nextForm);
      setSuccess('Tuyệt vời! Cập nhật hồ sơ thành công rồi nha.');
    } catch (e2) {
      setError(formatApiError(e2, 'Rất tiếc, cập nhật hồ sơ thất bại. Bạn thử lại nha!'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="main-wrapper">

      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Hồ sơ người dùng</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Hồ sơ người dùng</li>
          </ul>
        </div>
      </section>

      {/* Dashboard Menu */}
      <UserDashboardMenu />

      {/* Page Content */}
      <div className="content court-bg" style={{ paddingTop: '90px' }}>
        <div className="container">

          {/* Profile Tabs */}
          <UserProfileTabs />

          <div className="row">
            <div className="col-sm-12">
              <div className="profile-detail-group">
                <div className="card">
                  <form onSubmit={handleSubmit}>
                    <div className="row">
                      {error && (
                        <div className="col-12">
                          <div className="alert alert-danger">{error}</div>
                        </div>
                      )}
                      {success && (
                        <div className="col-12">
                          <div className="alert alert-success">{success}</div>
                        </div>
                      )}

                      {/* Avatar Upload */}
                      <div className="col-md-12">
                        <div className="file-upload-text">
                          <div
                            className="file-upload"
                            style={{ cursor: 'pointer' }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {avatarPreview ? (
                              <img
                                src={avatarPreview}
                                className="img-fluid rounded-circle"
                                alt="Avatar"
                                style={{ width: 80, height: 80, objectFit: 'cover' }}
                              />
                            ) : (
                              <img
                                src="/assets/assets/img/icons/img-icon.svg"
                                className="img-fluid"
                                alt="Upload"
                              />
                            )}
                            <p>Tải ảnh lên</p>
                            <span>
                              <i className="feather-edit-3"></i>
                              <input
                                type="file"
                                id="file-input"
                                ref={fileInputRef}
                                accept="image/jpg,image/jpeg,image/png,image/svg+xml"
                                onChange={handleAvatarChange}
                                style={{ display: 'none' }}
                              />
                            </span>
                          </div>
                          <h5>Tải ảnh đại diện, kích thước tối thiểu 150×150 px (JPG, PNG, SVG).</h5>
                        </div>
                      </div>

                      {/* Personal Information Heading */}
                      <div className="address-form-head">
                        <h4>Thông tin cá nhân</h4>
                      </div>

                      {/* Full Name */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Họ và tên</label>
                          <input
                            type="text"
                            className={`form-control ${fieldErrors.fullName ? 'is-invalid' : ''}`}
                            name="fullName"
                            placeholder="Nhập họ và tên"
                            value={form.fullName}
                            onChange={handleChange}
                          />
                          {fieldErrors.fullName && <div className="invalid-feedback d-block mt-1">{fieldErrors.fullName}</div>}
                        </div>
                      </div>

                      {/* Email (read-only) */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={authUser?.email || ''}
                            readOnly
                            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                          />
                        </div>
                      </div>

                      {/* Phone number */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Số điện thoại</label>
                          <input
                            type="tel"
                            className={`form-control ${fieldErrors.phoneNumber ? 'is-invalid' : ''}`}
                            name="phoneNumber"
                            placeholder="Nhập số điện thoại"
                            value={form.phoneNumber}
                            onChange={handleChange}
                          />
                          {fieldErrors.phoneNumber && <div className="invalid-feedback d-block mt-1">{fieldErrors.phoneNumber}</div>}
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Giới tính</label>
                          <select
                            className="form-control"
                            name="gender"
                            value={form.gender}
                            onChange={handleChange}
                          >
                            <option value="">-- Chọn giới tính --</option>
                            <option value="MALE">Nam</option>
                            <option value="FEMALE">Nữ</option>
                            <option value="OTHER">Khác</option>
                          </select>
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Ngày sinh</label>
                          <input
                            type="date"
                            className="form-control"
                            name="dateOfBirth"
                            value={form.dateOfBirth}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* About */}
                      <div className="col-lg-12 col-md-12">
                        <div className="info-about">
                          <label htmlFor="about" className="form-label">
                            Giới thiệu bản thân
                          </label>
                          <textarea
                            className="form-control"
                            id="about"
                            name="about"
                            rows="3"
                            placeholder="Viết vài dòng về bản thân..."
                            value={form.about}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* Address Section */}
                      <div className="address-form-head">
                        <h4>Địa chỉ</h4>
                      </div>

                      <div className="col-lg-12 col-md-12">
                        <div className="input-space">
                          <label className="form-label">Địa chỉ cụ thể</label>
                          <input
                            type="text"
                            className="form-control"
                            name="address"
                            placeholder="Số nhà, tên đường, phường/xã"
                            value={form.address}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Quận / Huyện</label>
                          <input
                            type="text"
                            className="form-control"
                            name="district"
                            placeholder="Nhập quận / huyện"
                            value={form.district}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <div className="input-space mb-0">
                          <label className="form-label">Tỉnh / Thành phố</label>
                          <select
                            className="form-control"
                            name="province"
                            value={form.province}
                            onChange={handleChange}
                          >
                            <option value="">-- Chọn tỉnh / thành phố --</option>
                            {PROVINCES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </div>
                  </form>
                </div>

                <div className="save-changes text-end">
                  <button
                    type="button"
                    className="btn btn-secondary reset-profile"
                    onClick={handleReset}
                  >
                    Đặt lại
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary save-profile"
                    onClick={handleSubmit}
                    disabled={loading || saving}
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

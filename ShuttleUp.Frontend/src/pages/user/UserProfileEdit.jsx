import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
import VietnamAddressFields from '../../components/user/VietnamAddressFields';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';
import {
  districtByCode,
  formatDistrictForStorage,
  loadVietnamDivisionTree,
  namesFromCodes,
  provinceByCode,
  resolveCodesFromProfile,
  wardByCode,
} from '../../utils/vietnamDivisions';

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
    skillLevel: '',
    playPurpose: '',
    playFrequency: '',
  });
  const [initialForm, setInitialForm] = useState(null);
  const [divisionTree, setDivisionTree] = useState(null);
  const [divisionLoadError, setDivisionLoadError] = useState('');
  const [addrCodes, setAddrCodes] = useState({ p: '', d: '', w: '' });

  useEffect(() => {
    let ok = true;
    loadVietnamDivisionTree()
      .then((t) => {
        if (ok) {
          setDivisionTree(t);
          setDivisionLoadError('');
        }
      })
      .catch(() => {
        if (ok) {
          setDivisionTree(null);
          setDivisionLoadError('Không tải được danh mục địa phương. Bạn thử tải lại trang nhé.');
        }
      });
    return () => {
      ok = false;
    };
  }, []);

  const initialSnapshotRef = useRef(null);

  useEffect(() => {
    if (!divisionTree || !initialForm) return;
    const snap = `${initialForm.province}\n${initialForm.district}\n${initialForm.address}`;
    if (initialSnapshotRef.current === snap) return;
    initialSnapshotRef.current = snap;
    const r = resolveCodesFromProfile(
      divisionTree,
      initialForm.province,
      initialForm.district
    );
    setAddrCodes({ p: r.provinceCode, d: r.districtCode, w: r.wardCode });
  }, [divisionTree, initialForm]);

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
    if (initialForm) {
      setForm(initialForm);
      if (divisionTree) {
        const r = resolveCodesFromProfile(
          divisionTree,
          initialForm.province,
          initialForm.district
        );
        setAddrCodes({ p: r.provinceCode, d: r.districtCode, w: r.wardCode });
        initialSnapshotRef.current = `${initialForm.province}\n${initialForm.district}\n${initialForm.address}`;
      }
    }
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
          skillLevel: u.skillLevel || '',
          playPurpose: u.playPurpose || '',
          playFrequency: u.playFrequency || '',
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
          skillLevel: '',
          playPurpose: '',
          playFrequency: '',
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

    let provinceOut = (form.province || '').trim();
    let districtOut = (form.district || '').trim();
    if (divisionTree && addrCodes.p) {
      const n = namesFromCodes(
        divisionTree,
        addrCodes.p,
        addrCodes.d,
        addrCodes.w
      );
      if (n.province) provinceOut = n.province;
      if (addrCodes.d) {
        districtOut = n.district || districtOut;
      }
    }

    setSaving(true);
    try {
      await profileApi.updateMe({
        fullName,
        phoneNumber: cleanedPhone || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        about: form.about || null,
        address: (form.address || '').trim() || null,
        district: districtOut || null,
        province: provinceOut || null,
        skillLevel: form.skillLevel || null,
        playPurpose: form.playPurpose || null,
        playFrequency: form.playFrequency || null,
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

      const addrTrim = (form.address || '').trim();
      const nextForm = {
        ...form,
        fullName,
        province: provinceOut || '',
        district: districtOut || '',
        address: addrTrim,
      };
      setForm(nextForm);
      initialSnapshotRef.current = `${nextForm.province}\n${nextForm.district}\n${nextForm.address}`;
      setInitialForm(nextForm);
      setSuccess('Tuyệt vời! Cập nhật hồ sơ thành công rồi nha.');
    } catch (e2) {
      setError(formatApiError(e2, 'Rất tiếc, cập nhật hồ sơ thất bại. Bạn thử lại nha!'));
    } finally {
      setSaving(false);
    }
  };

  const onProvinceCode = (pCode) => {
    if (!divisionTree) return;
    const pr = provinceByCode(divisionTree, pCode);
    setAddrCodes({ p: pCode, d: '', w: '' });
    setForm((f) => ({ ...f, province: pr?.n ?? '', district: '' }));
  };

  const onDistrictCode = (dCode) => {
    if (!divisionTree) return;
    const di = districtByCode(divisionTree, addrCodes.p, dCode);
    const pr = provinceByCode(divisionTree, addrCodes.p);
    setAddrCodes((c) => ({ ...c, d: dCode, w: '' }));
    setForm((f) => ({
      ...f,
      province: pr?.n ?? f.province,
      district: di ? formatDistrictForStorage('', di.n) : '',
    }));
  };

  const onWardCode = (wCode) => {
    if (!divisionTree) return;
    const wn = wardByCode(divisionTree, addrCodes.p, addrCodes.d, wCode);
    const di = districtByCode(divisionTree, addrCodes.p, addrCodes.d);
    const pr = provinceByCode(divisionTree, addrCodes.p);
    setAddrCodes((c) => ({ ...c, w: wCode }));
    setForm((f) => ({
      ...f,
      province: pr?.n ?? f.province,
      district: formatDistrictForStorage(wn?.n, di?.n),
    }));
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
                          <ShuttleDateField
                            value={form.dateOfBirth ? form.dateOfBirth.substring(0, 10) : ''}
                            onChange={(ymd) => setForm(f => ({ ...f, dateOfBirth: ymd }))}
                            placeholder="Ngày sinh"
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
                            placeholder="Tip: Ghi chú thêm về phong cách chơi của bạn (vui vẻ, máu lửa...), hoặc sân nhà quen thuộc..."
                            value={form.about}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* Address Section */}
                      <div className="address-form-head">
                        <h4>Địa chỉ</h4>
                      </div>

                      {divisionLoadError && (
                        <div className="col-12">
                          <div className="alert alert-warning">{divisionLoadError}</div>
                        </div>
                      )}

                      <VietnamAddressFields
                        tree={divisionTree}
                        street={form.address}
                        onStreetChange={(v) => {
                          setForm((f) => ({ ...f, address: v }));
                          if (fieldErrors.address) {
                            setFieldErrors((prev) => ({ ...prev, address: '' }));
                          }
                        }}
                        provinceCode={addrCodes.p}
                        districtCode={addrCodes.d}
                        wardCode={addrCodes.w}
                        onChangeProvinceCode={onProvinceCode}
                        onChangeDistrictCode={onDistrictCode}
                        onChangeWardCode={onWardCode}
                        disabled={loading || saving}
                      />

                      {/* Personalization Section */}
                      <div className="address-form-head mt-4">
                        <h4>Mục tiêu & Kỹ năng</h4>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Trình độ kỹ năng</label>
                          <select
                            className="form-control"
                            name="skillLevel"
                            value={form.skillLevel}
                            onChange={handleChange}
                          >
                            <option value="">-- Chọn trình độ --</option>
                            <option value="Yếu">Yếu / Mới chơi</option>
                            <option value="Trung Bình Yếu">Trung Bình Yếu</option>
                            <option value="Trung Bình">Trung Bình</option>
                            <option value="Khá">Khá</option>
                            <option value="Bán Chuyên">Bán Chuyên</option>
                            <option value="Chuyên Nghiệp">Chuyên Nghiệp</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Mục tiêu chơi chính</label>
                          <select
                            className="form-control"
                            name="playPurpose"
                            value={form.playPurpose}
                            onChange={handleChange}
                          >
                            <option value="">-- Chọn mục tiêu --</option>
                            <option value="Giải trí, vận động">Giải trí, vận động</option>
                            <option value="Tập luyện nghiêm túc">Tập luyện nghiêm túc</option>
                            <option value="Tìm partner cố định">Tìm partner cố định</option>
                            <option value="Đánh giải, cọ xát">Đánh giải, cọ xát</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <div className="input-space mb-0">
                          <label className="form-label">Tần suất chơi</label>
                          <select
                            className="form-control"
                            name="playFrequency"
                            value={form.playFrequency}
                            onChange={handleChange}
                          >
                            <option value="">-- Chọn tần suất --</option>
                            <option value="Thỉnh thoảng">Thỉnh thoảng</option>
                            <option value="1-2 lần/tuần">1-2 lần/tuần</option>
                            <option value="Chỉ cuối tuần">Chỉ cuối tuần</option>
                            <option value="Hàng ngày">Hàng ngày</option>
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

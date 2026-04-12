import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import VietnamAddressFields from '../../components/user/VietnamAddressFields';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
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

function sliceYmd(s) {
  if (!s) return '';
  const t = String(s).trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function dobMinIso() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dobMaxIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

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
          dateOfBirth: sliceYmd(u.dateOfBirth || ''),
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
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-user-edit text-emerald-600"></i>
              Cài đặt hồ sơ
            </h2>
            <p className="text-slate-500 text-sm m-0">Cập nhật thông tin cá nhân của bạn để người khác dễ dàng tìm thấy.</p>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Avatar Sidebar */}
        <div className="col-lg-4 col-md-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 sticky top-28">
            <h5 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
              Ảnh đại diện
            </h5>
            <div className="text-center p-4">
              <div className="relative inline-block mb-4 group">
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full scale-110 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img
                  src={avatarPreview || form.avatarUrl || '/assets/assets/img/profiles/avatar-01.jpg'}
                  alt="Avatar Preview"
                  className="w-40 h-40 rounded-full object-cover border-8 border-slate-50 shadow-sm relative z-10"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-700 transition-colors z-20 border-4 border-white"
                  title="Thay đổi ảnh"
                >
                  <i className="fa-solid fa-camera"></i>
                </button>
              </div>
              <input
                type="input"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <p className="text-xs text-slate-400 mt-2 px-4">
                Chấp nhận định dạng JPG, PNG. Dung lượng tối đa 2MB.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-slate-50">
              <button onClick={handleReset} type="button" className="btn bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold py-2.5">
                 Đặt lại ban đầu
              </button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="col-lg-8 col-md-7">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <form onSubmit={handleSubmit} className="user-profile-form space-y-6">

              {error && (
                <div className="alert alert-danger mb-4 rounded-xl border-0 shadow-sm flex items-center gap-3">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success mb-4 rounded-xl border-0 shadow-sm flex items-center gap-3">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>{success}</span>
                </div>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <h5 className="user-profile-form-section-title mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-emerald-500" aria-hidden />
                  Thông tin cá nhân
                </h5>
                <div className="row g-3">
                  <div className="col-lg-6">
                    <label className="form-label user-profile-form-label">Họ và tên</label>
                    <input
                      type="text"
                      className={`form-control rounded-xl border-slate-200 py-2.5 ${fieldErrors.fullName ? 'is-invalid border-rose-400' : ''}`}
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                    />
                    {fieldErrors.fullName && <div className="text-rose-500 text-[12px] mt-1 font-semibold">{fieldErrors.fullName}</div>}
                  </div>
                  <div className="col-lg-6">
                    <label className="form-label user-profile-form-label">Số điện thoại</label>
                    <input
                      type="tel"
                      className={`form-control rounded-xl border-slate-200 py-2.5 ${fieldErrors.phoneNumber ? 'is-invalid border-rose-400' : ''}`}
                      name="phoneNumber"
                      value={form.phoneNumber}
                      onChange={handleChange}
                    />
                    {fieldErrors.phoneNumber && <div className="text-rose-500 text-[12px] mt-1 font-semibold">{fieldErrors.phoneNumber}</div>}
                  </div>
                  <div className="col-lg-6">
                    <label className="form-label user-profile-form-label">Giới tính</label>
                    <select
                      className="form-control rounded-xl border-slate-200 py-2.5"
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
                  <div className="col-lg-6">
                    <label className="form-label user-profile-form-label" htmlFor="profile-dob">
                      Ngày sinh
                    </label>
                    <ShuttleDateField
                      id="profile-dob"
                      value={form.dateOfBirth}
                      onChange={(ymd) => {
                        setForm((prev) => ({ ...prev, dateOfBirth: ymd }));
                        if (fieldErrors.dateOfBirth) setFieldErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                      }}
                      placeholder="Chọn ngày sinh"
                      minDate={dobMinIso()}
                      maxDate={dobMaxIso()}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label user-profile-form-label">Giới thiệu bản thân</label>
                    <textarea
                      className="form-control rounded-xl border-slate-200 py-2.5"
                      name="about"
                      rows="3"
                      placeholder="Một chút về phong cách chơi của bạn..."
                      value={form.about}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4 pt-6 mt-6 border-t border-slate-50">
                <h5 className="user-profile-form-section-title mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-emerald-500" aria-hidden />
                  Địa chỉ liên hệ
                </h5>
                {divisionLoadError && <div className="alert alert-warning text-sm rounded-xl">{divisionLoadError}</div>}
                <VietnamAddressFields
                  tree={divisionTree}
                  street={form.address}
                  onStreetChange={(v) => {
                    setForm((f) => ({ ...f, address: v }));
                    if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: '' }));
                  }}
                  provinceCode={addrCodes.p}
                  districtCode={addrCodes.d}
                  wardCode={addrCodes.w}
                  onChangeProvinceCode={onProvinceCode}
                  onChangeDistrictCode={onDistrictCode}
                  onChangeWardCode={onWardCode}
                  disabled={loading || saving}
                />
              </div>

              {/* Personalization Section */}
              <div className="space-y-4 pt-6 mt-6 border-t border-slate-50">
                <h5 className="user-profile-form-section-title mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-emerald-500" aria-hidden />
                  Kỹ năng & Mục tiêu
                </h5>
                <div className="row g-3">
                  <div className="col-lg-4">
                    <label className="form-label user-profile-form-label">Trình độ</label>
                    <select
                      className="form-control rounded-xl border-slate-200 py-2.5"
                      name="skillLevel"
                      value={form.skillLevel}
                      onChange={handleChange}
                    >
                      <option value="">-- Chọn trình độ --</option>
                      <option value="Yếu">Yếu / Mới chơi</option>
                      <option value="Trung Bình">Trung Bình</option>
                      <option value="Khá">Khá</option>
                      <option value="Bán Chuyên">Bán Chuyên</option>
                      <option value="Chuyên Nghiệp">Chuyên Nghiệp</option>
                    </select>
                  </div>
                  <div className="col-lg-4">
                    <label className="form-label user-profile-form-label">Mục tiêu</label>
                    <select
                      className="form-control rounded-xl border-slate-200 py-2.5"
                      name="playPurpose"
                      value={form.playPurpose}
                      onChange={handleChange}
                    >
                      <option value="">-- Chọn mục tiêu --</option>
                      <option value="Giải trí">Giải trí, vận động</option>
                      <option value="Tập luyện">Tập luyện nghiêm túc</option>
                      <option value="Thi đấu">Đánh giải, cọ xát</option>
                    </select>
                  </div>
                  <div className="col-lg-4">
                    <label className="form-label user-profile-form-label">Tần suất</label>
                    <select
                      className="form-control rounded-xl border-slate-200 py-2.5"
                      name="playFrequency"
                      value={form.playFrequency}
                      onChange={handleChange}
                    >
                      <option value="">-- Tần suất --</option>
                      <option value="Thỉnh thoảng">Thỉnh thoảng</option>
                      <option value="1-2 lần/tuần">1-2 lần/tuần</option>
                      <option value="Hàng ngày">Hàng ngày</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-50">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-emerald min-w-[140px] px-8 py-2.5 font-bold shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                      <span>Đang lưu</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

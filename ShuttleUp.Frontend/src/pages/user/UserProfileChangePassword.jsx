import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword, setPassword } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { notifySuccess, notifyError } from '../../hooks/useNotification';

export default function UserProfileChangePassword() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const isGoogleUser = user?.authProvider === 'GOOGLE';
  const hasPassword = !!user?.hasPassword; // sẽ xác định qua PasswordHash ở backend

  // Google user chưa có password → mode "SET", còn lại → mode "CHANGE"
  // Nếu isGoogleUser và chưa set password → show form "Thêm mật khẩu"
  // Sau khi set xong hoặc LOCAL user → show form "Đổi mật khẩu"
  const [passwordSet, setPasswordSet] = useState(false);
  const showSetPasswordForm = isGoogleUser && !passwordSet;

  // ── Form state cho "Đổi mật khẩu" (LOCAL) ──
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  // ── Form state cho "Thêm mật khẩu" (GOOGLE) ──
  const [setForm2, setSetForm2] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [show, setShow] = useState({
    current: false,
    newPw: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Handlers cho form "Đổi mật khẩu" (LOCAL) ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleReset = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const handleSubmitChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const newErrors = {};
    if (!form.currentPassword) newErrors.currentPassword = 'Bạn chưa nhập mật khẩu hiện tại.';
    if (!form.newPassword) {
      newErrors.newPassword = 'Bạn chưa nhập mật khẩu mới.';
    } else if (form.newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu mới cần từ 6 ký tự trở lên bạn nhé.';
    }
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Bạn chưa xác nhận mật khẩu.';
    } else if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Oops... Mật khẩu xác nhận chưa khớp nhau rồi!';
    }

    if (Object.keys(newErrors).length > 0) { setFieldErrors(newErrors); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await changePassword(form);
      setSuccess('Tuyệt vời! Đổi mật khẩu thành công rồi nha. Bạn đăng nhập lại nhé!');
      notifySuccess('Đổi mật khẩu thành công!');
      handleReset();
      setTimeout(() => { logout(); navigate('/login'); }, 2000);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.response?.data?.title ?? 'Oops... Có sự cố khi đổi mật khẩu, bạn thử lại nha.';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers cho form "Thêm mật khẩu" (GOOGLE) ──
  const handleChange2 = (e) => {
    const { name, value } = e.target;
    setSetForm2((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmitSet = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const newErrors = {};
    if (!setForm2.newPassword) {
      newErrors.newPassword = 'Bạn chưa nhập mật khẩu mới.';
    } else if (setForm2.newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu cần từ 6 ký tự trở lên bạn nhé.';
    }
    if (!setForm2.confirmPassword) {
      newErrors.confirmPassword = 'Bạn chưa xác nhận mật khẩu.';
    } else if (setForm2.newPassword !== setForm2.confirmPassword) {
      newErrors.confirmPassword = 'Oops... Mật khẩu xác nhận chưa khớp nhau rồi!';
    }

    if (Object.keys(newErrors).length > 0) { setFieldErrors(newErrors); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await setPassword(setForm2);
      setSuccess('Tuyệt vời! Thêm mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng email và mật khẩu!');
      notifySuccess('Thêm mật khẩu thành công!');
      setSetForm2({ newPassword: '', confirmPassword: '' });
      setPasswordSet(true);
      // Cập nhật context: giờ user đã có password
      updateUser({ authProvider: 'GOOGLE' });
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Oops... Có sự cố khi thêm mật khẩu, bạn thử lại nha.';
      setError(msg);
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER: Form "Thêm mật khẩu" cho Google user ──
  if (showSetPasswordForm) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                <i className="fa-solid fa-key text-emerald-600"></i>
                Thêm mật khẩu
              </h2>
              <p className="text-slate-500 text-sm m-0">
                Nhập mật khẩu mới bên dưới để thêm mật khẩu cho tài khoản của bạn
              </p>
            </div>
            {/* Google badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50/60">
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-sm font-semibold text-emerald-700">Tài khoản Google</span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
            <form onSubmit={handleSubmitSet} className="space-y-6">
              {error && (
                <div className="alert alert-danger rounded-xl border-0 shadow-sm flex items-center gap-3 bg-rose-50 text-rose-700 py-3 px-4">
                  <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
                  <span className="font-semibold text-sm">{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success rounded-xl border-0 shadow-sm flex items-center gap-3 bg-emerald-50 text-emerald-700 py-3 px-4">
                  <i className="fa-solid fa-circle-check text-emerald-500"></i>
                  <span className="font-semibold text-sm">{success}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Mật khẩu mới */}
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 px-1">Mật khẩu mới</label>
                  <div className="pass-group relative">
                    <input
                      type={show.newPw ? 'text' : 'password'}
                      className={`form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${fieldErrors.newPassword ? 'border-rose-400 bg-rose-50/20' : ''}`}
                      name="newPassword"
                      placeholder="Ít nhất 6 ký tự"
                      value={setForm2.newPassword}
                      onChange={handleChange2}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => ({ ...s, newPw: !s.newPw }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 p-0"
                    >
                      <i className={`fa-solid ${show.newPw ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                    </button>
                  </div>
                  {fieldErrors.newPassword && <div className="text-rose-500 text-[11px] font-bold px-1 mt-1">{fieldErrors.newPassword}</div>}
                </div>

                {/* Xác nhận mật khẩu */}
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 px-1">Nhập lại mật khẩu mới</label>
                  <div className="pass-group relative">
                    <input
                      type={show.confirm ? 'text' : 'password'}
                      className={`form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : ''}`}
                      name="confirmPassword"
                      placeholder="Nhập lại mật khẩu mới"
                      value={setForm2.confirmPassword}
                      onChange={handleChange2}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 p-0"
                    >
                      <i className={`fa-solid ${show.confirm ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && <div className="text-rose-500 text-[11px] font-bold px-1 mt-1">{fieldErrors.confirmPassword}</div>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-50 mt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-emerald px-8 py-2.5 font-bold shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                      <span>Đang xử lý</span>
                    </>
                  ) : (
                    <span>Tiếp tục</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Form "Đổi mật khẩu" cho LOCAL user (hoặc Google user đã set password) ──
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-emerald-600"></i>
              Đổi mật khẩu
            </h2>
            <p className="text-slate-500 text-sm m-0">Đảm bảo tài khoản của bạn luôn được bảo vệ bằng mật khẩu mạnh.</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          <form onSubmit={handleSubmitChange} className="space-y-6">
            {error && (
              <div className="alert alert-danger rounded-xl border-0 shadow-sm flex items-center gap-3 bg-rose-50 text-rose-700 py-3 px-4">
                <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
                <span className="font-semibold text-sm">{error}</span>
              </div>
            )}
            {success && (
              <div className="alert alert-success rounded-xl border-0 shadow-sm flex items-center gap-3 bg-emerald-50 text-emerald-700 py-3 px-4">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                <span className="font-semibold text-sm">{success}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 px-1">Mật khẩu hiện tại</label>
                <div className="pass-group relative">
                  <input
                    type={show.current ? 'text' : 'password'}
                    className={`form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${fieldErrors.currentPassword ? 'border-rose-400 bg-rose-50/20' : ''}`}
                    name="currentPassword"
                    placeholder="********"
                    value={form.currentPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 p-0"
                  >
                    <i className={`fa-solid ${show.current ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                  </button>
                </div>
                {fieldErrors.currentPassword && <div className="text-rose-500 text-[11px] font-bold px-1 mt-1">{fieldErrors.currentPassword}</div>}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 px-1">Mật khẩu mới</label>
                <div className="pass-group relative">
                  <input
                    type={show.newPw ? 'text' : 'password'}
                    className={`form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${fieldErrors.newPassword ? 'border-rose-400 bg-rose-50/20' : ''}`}
                    name="newPassword"
                    placeholder="Ít nhất 6 ký tự"
                    value={form.newPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => ({ ...s, newPw: !s.newPw }))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 p-0"
                  >
                    <i className={`fa-solid ${show.newPw ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                  </button>
                </div>
                {fieldErrors.newPassword && <div className="text-rose-500 text-[11px] font-bold px-1 mt-1">{fieldErrors.newPassword}</div>}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 px-1">Xác nhận mật khẩu</label>
                <div className="pass-group relative">
                  <input
                    type={show.confirm ? 'text' : 'password'}
                    className={`form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : ''}`}
                    name="confirmPassword"
                    placeholder="Nhập lại mật khẩu mới"
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 p-0"
                  >
                    <i className={`fa-solid ${show.confirm ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                  </button>
                </div>
                {fieldErrors.confirmPassword && <div className="text-rose-500 text-[11px] font-bold px-1 mt-1">{fieldErrors.confirmPassword}</div>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50 mt-8">
              <button
                type="button"
                className="btn user-form-cancel px-6 py-2.5 rounded-[0.75rem] font-bold"
                onClick={handleReset}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-emerald px-8 py-2.5 font-bold shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                    <span>Đang xử lý</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save" aria-hidden />
                    <span>Đổi mật khẩu</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import { changePassword } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export default function UserProfileChangePassword() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const newErrors = {};

    if (!form.currentPassword) {
      newErrors.currentPassword = 'Bạn chưa nhập mật khẩu hiện tại.';
    }
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

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      await changePassword(form);
      setSuccess('Tuyệt vời! Đổi mật khẩu thành công rồi nha. Bạn đăng nhập lại nhé!');
      handleReset();
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message
        ?? err.response?.data?.title
        ?? 'Oops... Có sự cố khi đổi mật khẩu, bạn thử lại nha.'
      );
    } finally {
      setLoading(false);
    }
  };

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
          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="btn bg-slate-50 text-slate-500 hover:bg-slate-100 px-6 py-2.5 rounded-xl font-bold transition-all"
                onClick={handleReset}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/10 transition-all gap-2"
              >
                {loading ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Đang xử lý</>
                ) : (
                  <><i className="fa-solid fa-save"></i> Đổi mật khẩu</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

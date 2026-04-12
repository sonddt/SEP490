import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserProfileTabs from '../../components/user/UserProfileTabs';

export default function UserProfileOtherSetting() {
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = () => {
    setNewEmail('');
    setNewPhone('');
    setSuccess('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: call API to update email/phone
    console.log('Saving other settings:', { newEmail, newPhone });
    setSuccess('Cập nhật thành công!');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-user-gear text-emerald-600"></i>
              Cài đặt khác
            </h2>
            <p className="text-slate-500 text-sm m-0">Quản lý các thông tin liên kết và bảo mật bổ sung.</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {success && (
              <div className="alert alert-success rounded-xl border-0 shadow-sm flex items-center gap-3 bg-emerald-50 text-emerald-700 py-3 px-4">
                <i className="fa-solid fa-circle-check text-emerald-500"></i>
                <span className="font-semibold text-sm">{success}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Change Email */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <i className="fa-solid fa-envelope text-emerald-500 text-sm"></i>
                  <h5 className="text-[15px] font-bold text-slate-800 m-0">Đổi Email</h5>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 px-1">Nhập địa chỉ email mới</label>
                  <input
                    type="email"
                    className="form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    placeholder="example@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Change Phone */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <i className="fa-solid fa-phone text-emerald-500 text-sm"></i>
                  <h5 className="text-[15px] font-bold text-slate-800 m-0">Đổi Số Điện Thoại</h5>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 px-1">Nhập số điện thoại mới</label>
                  <input
                    type="tel"
                    className="form-control rounded-xl border-slate-200 py-3 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    placeholder="0123 456 789"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50 mt-8">
              <button
                type="button"
                className="btn bg-slate-50 text-slate-500 hover:bg-slate-100 px-6 py-2.5 rounded-xl font-bold border-0 transition-all"
                onClick={handleReset}
              >
                Đặt lại
              </button>
              <button
                type="submit"
                className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-2 border-0"
              >
                <i className="fa-solid fa-save"></i>
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

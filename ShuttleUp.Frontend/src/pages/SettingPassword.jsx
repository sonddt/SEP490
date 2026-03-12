import { useState } from 'react';
import { Link } from 'react-router-dom';

/* This component represents the 'setting-password.html' logged-in user change password page.
   It would typically be used inside a Dashboard Layout. */
export default function SettingPassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp!');
      return;
    }
    console.log('Password settings updated');
  };

  return (
    <div className="content court-bg">
      <div className="container">
        {/* Profile Navigation (Mockup) */}
        <div className="coach-court-list profile-court-list">
          <ul className="nav">
            <li><Link to="/manager/profile">Hồ sơ</Link></li>
            <li><Link to="/manager/availability">Thời gian hoạt động</Link></li>
            <li><Link className="active" to="/manager/setting-password">Đổi Mật Khẩu</Link></li>
            <li><Link to="/manager/other-settings">Cài đặt khác</Link></li>
          </ul>
        </div>
        
        <div className="row">
          <div className="col-sm-12">
            <div className="profile-detail-group">
              <div className="card">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space">
                        <label className="form-label">Mật khẩu cũ</label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập mật khẩu cũ" 
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space">
                        <label className="form-label">Mật khẩu mới</label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập mật khẩu mới" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space mb-0">
                        <label className="form-label">Xác nhận mật khẩu</label>
                        <input 
                          type="password" 
                          className="form-control" 
                          placeholder="Nhập lại mật khẩu mới" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <div className="save-changes text-end">
                <button 
                  type="button" 
                  className="btn btn-primary reset-profile me-2"
                  onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                >
                  Xóa Lại
                </button>
                <button type="submit" className="btn btn-secondary save-profile" onClick={handleSubmit}>
                  Lưu Thay Đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

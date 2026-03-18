import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
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
    <div className="main-wrapper">

      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Hồ sơ người dùng</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Cài đặt khác</li>
          </ul>
        </div>
      </section>

      {/* Dashboard Menu */}
      <UserDashboardMenu />

      {/* Page Content */}
      <div className="content court-bg">
        <div className="container">

          {/* Profile Tabs */}
          <UserProfileTabs />

          <div className="row">
            <div className="col-sm-12">
              <div className="profile-detail-group">
                <div className="card">
                  <form onSubmit={handleSubmit}>
                    <div className="row">

                      {/* Success Alert */}
                      {success && (
                        <div className="col-12">
                          <div className="alert alert-success">{success}</div>
                        </div>
                      )}

                      {/* Change Email */}
                      <div className="col-lg-12">
                        <div className="appoint-head">
                          <h4>Đổi Email</h4>
                        </div>
                        <div className="input-space other-setting-form">
                          <label className="form-label">Nhập địa chỉ email mới</label>
                          <div className="group-img">
                            <i className="feather-mail"></i>
                            <input
                              type="email"
                              className="form-control"
                              placeholder="Địa chỉ email mới"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Change Phone */}
                      <div className="col-lg-12">
                        <div className="appoint-head">
                          <h4>Đổi Số Điện Thoại</h4>
                        </div>
                        <div className="input-space other-setting-form">
                          <label className="form-label">Nhập số điện thoại mới</label>
                          <div className="group-img">
                            <i className="feather-phone"></i>
                            <input
                              type="tel"
                              className="form-control"
                              placeholder="Số điện thoại mới"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value)}
                            />
                          </div>
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
                    type="submit"
                    className="btn btn-primary save-profile"
                    onClick={handleSubmit}
                  >
                    Lưu thay đổi
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

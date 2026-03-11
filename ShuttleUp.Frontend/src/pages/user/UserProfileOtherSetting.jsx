import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';

export default function UserProfileOtherSetting() {
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
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

  const handleDeactivate = () => {
    // TODO: call API to deactivate account
    console.log('Deactivating account...');
    setShowDeactivateModal(false);
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

                      {/* Deactivate Account */}
                      <div className="col-lg-12">
                        <div className="deactivate-account-blk">
                          <div className="deactivate-detail">
                            <h4>Vô hiệu hóa tài khoản</h4>
                            <p>Nhấn nút bên dưới để vô hiệu hóa tài khoản của bạn</p>
                          </div>
                          <button
                            type="button"
                            className="btn deactive-btn"
                            onClick={() => setShowDeactivateModal(true)}
                          >
                            <i className="feather-zap-off"></i> Vô hiệu hóa
                          </button>
                        </div>
                      </div>

                    </div>
                  </form>
                </div>

                <div className="save-changes text-end">
                  <button
                    type="button"
                    className="btn btn-primary reset-profile"
                    onClick={handleReset}
                  >
                    Đặt lại
                  </button>
                  <button
                    type="submit"
                    className="btn btn-secondary save-profile"
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

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Xác nhận vô hiệu hóa tài khoản</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeactivateModal(false)}
                />
              </div>
              <div className="modal-body">
                <p>Bạn có chắc chắn muốn vô hiệu hóa tài khoản?<br />
                  Hành động này sẽ đăng xuất bạn khỏi hệ thống và tạm dừng tài khoản.</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowDeactivateModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeactivate}
                >
                  Xác nhận vô hiệu hóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';

const MOCK_USER = {
  name: 'Nguyễn Văn A',
  avatar: '/assets/assets/img/profiles/avatar-01.jpg',
  joinDate: '01/01/2025',
  level: 'Trung bình',
  location: 'Hà Nội, Việt Nam',
  email: 'player@shuttleup.vn',
  phone: '+84 909 123 456',
  address: '123 Đường ABC, Quận 1, Hà Nội',
  bio: 'Tôi yêu thích cầu lông và đang tìm kiếm những người bạn chơi cùng. Trình độ trung bình, thích chơi đôi và phong trào.',
};

export default function MyProfile() {
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

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
          <h1 className="text-white">Hồ sơ của tôi</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Hồ sơ của tôi</li>
          </ul>
        </div>
      </section>

      {/* Dashboard Menu */}
      <UserDashboardMenu />

      {/* Page Content */}
      <div className="content court-bg">
        <div className="container">
          <div className="row">

            {/* Profile Header */}
            <div className="col-lg-12">
              <div className="my-profile-box">
                <h3>Hồ sơ của tôi</h3>
                <div className="card profile-user-view">
                  <div className="profile-groups">
                    <div className="profile-detail-box">
                      <div className="profile-img">
                        <img
                          className="rounded-circle"
                          src={MOCK_USER.avatar}
                          alt={MOCK_USER.name}
                        />
                      </div>
                      <div className="user-profile-detail">
                        <h4>{MOCK_USER.name}</h4>
                        <p>ShuttleUp – Tham gia từ {MOCK_USER.joinDate}</p>
                        <ul>
                          <li>
                            <img src="/assets/assets/img/icons/profile-icon-01.svg" alt="Icon" />
                            Trình độ: {MOCK_USER.level}
                          </li>
                          <li>
                            <img src="/assets/assets/img/icons/profile-icon-02.svg" alt="Icon" />
                            {MOCK_USER.location}
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="convenient-btns">
                      <button
                        type="button"
                        className="btn btn-danger d-inline-flex align-items-center me-2"
                        onClick={() => setShowDeactivateModal(true)}
                      >
                        <span><i className="feather-zap-off"></i></span>Vô hiệu hóa
                      </button>
                      <Link
                        to="/user/profile"
                        className="btn btn-secondary d-inline-flex align-items-center me-2"
                      >
                        <span><i className="feather-edit"></i></span>Chỉnh sửa hồ sơ
                      </Link>
                      <Link
                        to="/user/profile/change-password"
                        className="btn btn-primary d-inline-flex align-items-center"
                      >
                        <span><i className="feather-lock"></i></span>Đổi mật khẩu
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="col-lg-12">
              <div className="card profile-user-view mb-0">
                <div className="profile-info-box">
                  <h4>Thông tin liên hệ</h4>
                  <div className="profile-contact-info">
                    <div className="contact-information">
                      <h6>Email</h6>
                      <span>{MOCK_USER.email}</span>
                    </div>
                    <div className="contact-information">
                      <h6>Số điện thoại</h6>
                      <span>{MOCK_USER.phone}</span>
                    </div>
                    <div className="contact-information">
                      <h6>Địa chỉ</h6>
                      <span>{MOCK_USER.address}</span>
                    </div>
                  </div>
                </div>

                <div className="profile-info-box">
                  <h4>Giới thiệu bản thân</h4>
                  <p>{MOCK_USER.bio}</p>
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

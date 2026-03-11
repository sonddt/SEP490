import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';

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

export default function UserProfileEdit() {
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    about: '',
    address: '',
    district: '',
    province: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleReset = () => {
    setForm({ fullName: '', gender: '', dateOfBirth: '', about: '', address: '', district: '', province: '' });
    setAvatarPreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: call API to update profile
    console.log('Saving profile:', form);
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

                      {/* Full Name */}
                      <div className="col-lg-4 col-md-6">
                        <div className="input-space">
                          <label className="form-label">Họ và tên</label>
                          <input
                            type="text"
                            className="form-control"
                            name="fullName"
                            placeholder="Nhập họ và tên"
                            value={form.fullName}
                            onChange={handleChange}
                          />
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

    </div>
  );
}

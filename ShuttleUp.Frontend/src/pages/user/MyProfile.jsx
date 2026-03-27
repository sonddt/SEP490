import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';

export default function MyProfile() {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await profileApi.getMe();
        if (!mounted) return;
        setProfile(data);
      } catch (e) {
        // Nếu API lỗi (401/500) vẫn cho UI hiển thị tối thiểu từ authUser
        if (!mounted) return;
        setError(e?.response?.data?.message || 'Không tải được hồ sơ.');
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const roles = useMemo(() => profile?.roles ?? authUser?.roles ?? [], [profile, authUser]);
  const managerProfile = profile?.managerProfile ?? null;
  const isManager = roles?.includes?.('MANAGER');
  const showManagerInfo = isManager || !!managerProfile;
  const managerFallbackText = isManager ? 'Chưa cập nhật' : 'Chưa đăng ký';

  const u = profile?.user ?? {
    fullName: authUser?.fullName || authUser?.email || '',
    email: authUser?.email || '',
    phoneNumber: authUser?.phoneNumber || null,
    about: null,
    address: null,
    district: null,
    province: null,
    gender: null,
    dateOfBirth: null,
    avatarUrl: null,
    createdAt: null,
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  };

  const formatAddress = () => {
    const parts = [u?.address, u?.district, u?.province].filter((x) => x && String(x).trim());
    return parts.length ? parts.join(', ') : 'Chưa cập nhật';
  };

  const managerBadge = (() => {
    const s = (managerProfile?.status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">APPROVED</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">REJECTED</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">PENDING</span>;
    if (showManagerInfo)
      return isManager
        ? <span className="badge bg-success">ĐÃ ĐĂNG KÝ</span>
        : <span className="badge bg-secondary">CHƯA ĐĂNG KÝ</span>;
    return null;
  })();

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
      <div className="content court-bg" style={{ paddingTop: '90px' }}>
        <div className="container">
          {loading && !profile && (
            <div className="text-muted mb-3">Đang tải hồ sơ...</div>
          )}
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
                          src={u?.avatarUrl || '/assets/assets/img/profiles/avatar-01.jpg'}
                          alt={u?.fullName}
                        />
                      </div>
                      <div className="user-profile-detail">
                        <h4>{u?.fullName || '—'}</h4>
                        <p>ShuttleUp – Tham gia từ {formatDate(u?.createdAt)}</p>
                        <ul>
                          <li>
                            <img src="/assets/assets/img/icons/profile-icon-01.svg" alt="Icon" />
                            Số điện thoại: {u?.phoneNumber || 'Chưa cập nhật'}
                          </li>
                          <li>
                            <img src="/assets/assets/img/icons/profile-icon-02.svg" alt="Icon" />
                            {u?.gender ? `Giới tính: ${u.gender}` : 'Chưa cập nhật giới tính'}
                          </li>
                          <li>
                            <img src="/assets/assets/img/icons/profile-icon-01.svg" alt="Icon" />
                            {u?.dateOfBirth ? `Ngày sinh: ${formatDate(u?.dateOfBirth)}` : 'Chưa cập nhật ngày sinh'}
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="convenient-btns">
                      <Link
                        to="/user/profile/edit"
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
                      <span>{u?.email || '—'}</span>
                    </div>
                    <div className="contact-information">
                      <h6>Số điện thoại</h6>
                      <span>{u?.phoneNumber || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="contact-information">
                      <h6>Địa chỉ</h6>
                      <span>{formatAddress()}</span>
                    </div>
                  </div>
                </div>

                <div className="profile-info-box">
                  <h4>Thông tin cá nhân</h4>
                  <p className="mb-0">
                    {u?.gender ? `Giới tính: ${u.gender}. ` : ''}
                    {u?.dateOfBirth ? `Ngày sinh: ${formatDate(u?.dateOfBirth)}. ` : ''}
                    {u?.about ? `Giới thiệu: ${u.about}` : (u?.gender || u?.dateOfBirth ? '' : 'Chưa có dữ liệu.')}
                  </p>
                </div>

                {showManagerInfo && (
                  <div className="profile-info-box mt-3">
                    <h4>Thông tin quản lý</h4>
                    <div className="d-flex align-items-center gap-2">
                      <div className="me-2">
                        {managerBadge}
                      </div>
                      {managerProfile?.status && (
                        <div className="text-muted" style={{ fontSize: 14 }}>
                          {managerProfile.status.toUpperCase() === 'PENDING'
                            ? 'Hồ sơ đang chờ duyệt.'
                            : managerProfile.status.toUpperCase() === 'REJECTED'
                              ? 'Hồ sơ đã bị từ chối.'
                              : managerProfile.status.toUpperCase() === 'APPROVED'
                                ? 'Hồ sơ đã được duyệt.'
                                : ''}
                        </div>
                      )}
                    </div>

                    <div className="profile-contact-info mt-3">
                      <div className="contact-information">
                        <h6>CCCD/CMND</h6>
                        {managerProfile?.cccdFrontUrl || managerProfile?.cccdBackUrl ? (
                          <div className="d-flex gap-2">
                            {managerProfile?.cccdFrontUrl && (
                              <img
                                src={managerProfile.cccdFrontUrl}
                                alt="CCCD mặt trước"
                                style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }}
                              />
                            )}
                            {managerProfile?.cccdBackUrl && (
                              <img
                                src={managerProfile.cccdBackUrl}
                                alt="CCCD mặt sau"
                                style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }}
                              />
                            )}
                          </div>
                        ) : (
                          <span>{managerFallbackText}</span>
                        )}
                      </div>
                      <div className="contact-information">
                        <h6>Mã số thuế</h6>
                        <span>{managerProfile?.taxCode || managerFallbackText}</span>
                      </div>
                      <div className="contact-information">
                        <h6>Giấy phép kinh doanh</h6>
                        {managerProfile?.businessLicenseFiles && managerProfile.businessLicenseFiles.length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {managerProfile.businessLicenseFiles.map((f, idx) => {
                              const isImage = (f.mimeType || '').startsWith('image/');
                              return (
                                <div key={f.id ?? idx}>
                                  {isImage ? (
                                    <img
                                      src={f.url}
                                      alt={`Giấy phép ${idx + 1}`}
                                      style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }}
                                    />
                                  ) : (
                                    <a href={f.url} target="_blank" rel="noreferrer">
                                      Xem PDF giấy phép {idx + 1}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span>{managerFallbackText}</span>
                        )}
                      </div>
                      <div className="contact-information">
                        <h6>Địa chỉ</h6>
                        <span>{managerProfile?.address || managerFallbackText}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning mx-3" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}

    </div>
  );
}

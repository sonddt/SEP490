import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';
import { formatDistrictForDisplay } from '../../utils/vietnamDivisions';

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
    const dist = formatDistrictForDisplay(u?.district);
    const parts = [u?.address, dist, u?.province].filter((x) => x && String(x).trim());
    return parts.length ? parts.join(', ') : 'Chưa cập nhật';
  };

  const formatGender = (g) => {
    if (!g) return null;
    switch (g.toUpperCase()) {
      case 'MALE': return 'Nam';
      case 'FEMALE': return 'Nữ';
      case 'OTHER': return 'Khác';
      default: return g;
    }
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
    <div className="space-y-6">
      {loading && !profile && (
        <div className="text-muted mb-3">Đang tải hồ sơ...</div>
      )}

      {error && (
        <div className="alert alert-warning mb-4">
          {error}
        </div>
      )}

      {/* Modern Profile Header Card */}
      <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 p-8 relative">
        <div className="absolute top-8 right-8">
          <Link to="/user/profile/edit" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
            <i className="fa-solid fa-pen-to-square"></i>
            Chỉnh sửa
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Base */}
          <div className="relative">
            <div className="w-28 h-28 rounded-[28px] shadow-[0_8px_24px_rgba(16,185,129,0.2)] bg-white overflow-hidden p-1">
              <img
                className="w-full h-full object-cover rounded-[24px]"
                src={u?.avatarUrl || '/assets/assets/img/profiles/avatar-01.jpg'}
                alt={u?.fullName}
              />
            </div>
            {/* Online Status Dot */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-[3px] border-white rounded-full"></div>
          </div>

          {/* User Text Info */}
          <div className="flex-1 text-center sm:text-left mt-2 sm:mt-0">
            <h3 className="text-[26px] font-extrabold text-slate-800 m-0 tracking-tight leading-tight">
              {u?.fullName || '—'}
            </h3>
            <p className="text-slate-500 text-[14px] font-medium mt-1 mb-4">
              Thành viên từ {formatDate(u?.createdAt)}
            </p>

            {/* Micro Info Badges */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                <i className="fa-solid fa-phone text-slate-400 text-[13px]"></i>
                <span className="text-[13px] font-semibold">{u?.phoneNumber || 'Chưa cập nhật'}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                <i className="fa-solid fa-user text-slate-400 text-[13px]"></i>
                <span className="text-[13px] font-semibold">{u?.gender ? formatGender(u.gender) : 'Giới tính'}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                <i className="fa-solid fa-cake-candles text-slate-400 text-[13px]"></i>
                <span className="text-[13px] font-semibold">{u?.dateOfBirth ? formatDate(u?.dateOfBirth) : 'Sinh nhật'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info Card */}
      <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 p-8">
        <h4 className="text-[18px] font-extrabold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
          Thông tin liên hệ
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-emerald-200 transition-colors">
            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email</h6>
            <span className="text-slate-800 font-bold text-[14.5px]">{u?.email || '—'}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-emerald-200 transition-colors">
            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Số điện thoại</h6>
            <span className="text-slate-800 font-bold text-[14.5px]">{u?.phoneNumber || 'Chưa cập nhật'}</span>
          </div>
          <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-emerald-200 transition-colors">
            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Địa chỉ</h6>
            <span className="text-slate-800 font-bold text-[14.5px] leading-relaxed">{formatAddress()}</span>
          </div>
        </div>
      </div>

      {/* Personal Info Card */}
      <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 p-8">
        <h4 className="text-[18px] font-extrabold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
          Thông tin cá nhân
        </h4>
        <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 text-slate-600 leading-relaxed font-medium text-[14.5px]">
          {u?.gender ? `Giới tính: ${formatGender(u.gender)}. ` : ''}
          {u?.dateOfBirth ? `Ngày sinh: ${formatDate(u?.dateOfBirth)}. ` : ''}
          {u?.about ? u.about : (u?.gender || u?.dateOfBirth ? '' : 'Chưa có thông tin giới thiệu.')}
        </div>
      </div>

      {/* Manager Info Card */}
      {showManagerInfo && (
        <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 p-8 mt-6">
          <h4 className="text-[18px] font-extrabold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
            Thông tin quản lý
          </h4>
          <div className="d-flex align-items-center gap-2 mb-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h6 className="text-sm font-semibold text-gray-500 mb-2">CCCD/CMND</h6>
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
                <span className="text-gray-900">{managerFallbackText}</span>
              )}
            </div>
            
            <div>
              <h6 className="text-sm font-semibold text-gray-500 mb-2">Mã số thuế</h6>
              <span className="text-gray-900">{managerProfile?.taxCode || managerFallbackText}</span>
            </div>

            <div className="md:col-span-2">
              <h6 className="text-sm font-semibold text-gray-500 mb-2">Giấy phép kinh doanh</h6>
              {managerProfile?.businessLicenseFiles && managerProfile.businessLicenseFiles.length > 0 ? (
                <div className="d-flex flex-wrap gap-3">
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
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            Xem PDF giấy phép {idx + 1}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-gray-900">{managerFallbackText}</span>
              )}
            </div>

            <div className="md:col-span-2">
              <h6 className="text-sm font-semibold text-gray-500 mb-2">Địa chỉ</h6>
              <span className="text-gray-900">{managerProfile?.address || managerFallbackText}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

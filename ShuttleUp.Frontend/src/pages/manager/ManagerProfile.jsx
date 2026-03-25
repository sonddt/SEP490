import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';

export default function ManagerProfile() {
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

  const u = profile?.user ?? {
    fullName: authUser?.fullName || authUser?.email || '',
    email: authUser?.email || '',
    phoneNumber: authUser?.phoneNumber || null,
    createdAt: null,
    avatarUrl: null,
  };

  const mp = profile?.managerProfile ?? null;
  const isManager = profile?.roles?.includes('MANAGER') || authUser?.roles?.includes('MANAGER');

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  };

  const managerBadge = (() => {
    const s = (mp?.status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">Đã phê duyệt</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">Bị từ chối</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">Đang chờ duyệt</span>;
    return isManager 
      ? <span className="badge bg-success">Đã xác thực</span> 
      : <span className="badge bg-secondary">Chưa đăng ký</span>;
  })();

  const fallbackText = isManager ? 'Chưa cập nhật' : 'Chưa đăng ký';

  return (
    <>
      <div className="mgr-header">
        <div className="mgr-header__title">
          <h1>Hồ sơ Quản lý</h1>
          <p>Xem thông tin liên hệ và giấy tờ kinh doanh của chủ sân</p>
        </div>
      </div>

      {loading && !profile ? (
        <div style={{ padding: 24, color: '#64748b' }}>Đang tải thông tin...</div>
      ) : (
        <div className="mgr-content" style={{ maxWidth: 900 }}>
          {error && (
            <div className="alert alert-warning mb-4" role="alert">
              {error}
            </div>
          )}

          {/* General Information Card */}
          <div className="card mb-4" style={{ border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div className="card-header" style={{ padding: '20px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', borderRadius: '12px 12px 0 0' }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Thông tin cá nhân</h5>
            </div>
            <div className="card-body" style={{ padding: 24 }}>
              <div className="d-flex align-items-center mb-4 pb-4" style={{ gap: 24, borderBottom: '1px solid #f1f5f9' }}>
                <img 
                  src={u?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'} 
                  alt="Avatar" 
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f8fafc' }}
                />
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontWeight: 700 }}>{u.fullName}</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                    Gia nhập: {formatDate(u.createdAt) || 'Không xác định'}
                  </p>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-sm-6">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Email</div>
                  <div style={{ color: '#1e293b', fontWeight: 500 }}>{u.email || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Số điện thoại</div>
                  <div style={{ color: '#1e293b', fontWeight: 500 }}>{u.phoneNumber || fallbackText}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Business Information Card */}
          <div className="card" style={{ border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div className="card-header d-flex justify-content-between align-items-center" style={{ padding: '20px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', borderRadius: '12px 12px 0 0' }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Thông tin Chủ Sân</h5>
              {managerBadge}
            </div>
            <div className="card-body" style={{ padding: 24 }}>
              <div className="row g-4 mb-4 pb-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="col-12">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Căn cước công dân</div>
                  {mp?.cccdFrontUrl || mp?.cccdBackUrl ? (
                    <div className="d-flex gap-3 mt-2">
                      {mp.cccdFrontUrl && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>Mặt trước</p>
                          <img src={mp.cccdFrontUrl} alt="CCCD Trước" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        </div>
                      )}
                      {mp.cccdBackUrl && (
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>Mặt sau</p>
                          <img src={mp.cccdBackUrl} alt="CCCD Sau" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{fallbackText}</div>
                  )}
                </div>
              </div>

              <div className="row g-4 pb-4 mb-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div className="col-sm-6">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Mã số thuế</div>
                  <div style={{ color: '#1e293b', fontWeight: 500 }}>{mp?.taxCode || fallbackText}</div>
                </div>
                <div className="col-sm-6">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Địa chỉ kinh doanh</div>
                  <div style={{ color: '#1e293b', fontWeight: 500 }}>{mp?.address || fallbackText}</div>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-12">
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Giấy phép kinh doanh</div>
                  {mp?.businessLicenseFiles?.length > 0 ? (
                    <div className="d-flex flex-wrap gap-3 mt-2">
                      {mp.businessLicenseFiles.map((f, idx) => {
                        const isImage = (f.mimeType || '').startsWith('image/');
                        return (
                          <div key={f.id ?? idx}>
                            {isImage ? (
                              <img src={f.url} alt={`Giấy phép ${idx + 1}`} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                            ) : (
                              <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '8px 12px', background: '#f1f5f9', borderRadius: 6, textDecoration: 'none', color: '#0f172a', fontSize: 13 }}>
                                <i className="feather-file-text me-2" /> Xem PDF {idx + 1}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{fallbackText}</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

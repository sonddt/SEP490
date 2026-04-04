import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import RelationshipActions from '../../components/user/RelationshipActions';
import socialApi from '../../api/socialApi';
import { useAuth } from '../../context/AuthContext';
import { buildProfileShareUrl, getProfileUserIdFromDecodedQr } from '../../utils/profileQr';
import { showBkToast } from '../../utils/bkToast';

export default function UserSocialSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id;

  const [mode, setMode] = useState('exact');
  const [exactQuery, setExactQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [nameDebounced, setNameDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [privacy, setPrivacy] = useState({ allowFindByEmail: true, allowFindByPhone: true });
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const p = await socialApi.getPrivacy();
        if (!m) return;
        setPrivacy({
          allowFindByEmail: !!p.allowFindByEmail,
          allowFindByPhone: !!p.allowFindByPhone,
        });
      } catch {
        if (m) showBkToast('Chưa tải được cài đặt riêng tư — bạn vẫn có thể tìm kiếm.', 'info');
      } finally {
        if (m) setPrivacyLoaded(true);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNameDebounced(nameQuery.trim()), 350);
    return () => clearTimeout(debounceRef.current);
  }, [nameQuery]);

  const runExact = async () => {
    const q = exactQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    try {
      setSearching(true);
      const data = await socialApi.searchExact(q);
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      showBkToast(e?.response?.data?.message || 'Không tìm được lúc này.', 'warning');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (mode !== 'name') return undefined;
    const q = nameDebounced;
    if (q.length < 1) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setSearching(true);
        const data = await socialApi.searchName(q, 20);
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setResults([]);
          showBkToast('Gợi ý tên chưa tải được — thử lại sau vài giây.', 'warning');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, nameDebounced]);

  const shareUrl = useMemo(() => (myId ? buildProfileShareUrl(myId) : ''), [myId]);

  const savePrivacy = async () => {
    try {
      await socialApi.putPrivacy(privacy);
      showBkToast('Đã lưu cài đặt riêng tư.', 'success');
    } catch (e) {
      showBkToast(e?.response?.data?.message || 'Chưa lưu được — thử lại nhé.', 'warning');
    }
  };

  const onQrFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            showBkToast('Trình duyệt chưa hỗ trợ đọc ảnh này.', 'warning');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (!code?.data) {
            showBkToast('Chưa đọc được mã trong ảnh — thử ảnh rõ hơn nhé.', 'info');
            return;
          }
          const uid = getProfileUserIdFromDecodedQr(code.data);
          if (!uid) {
            showBkToast('Liên kết trong mã không thuộc hồ sơ ShuttleUp.', 'info');
            return;
          }
          navigate(`/user/profile/${uid}`);
        };
        img.onerror = () => showBkToast('Không mở được file ảnh.', 'warning');
        img.src = reader.result;
      };
      reader.onerror = () => showBkToast('Không đọc được file.', 'warning');
      reader.readAsDataURL(file);
    },
    [navigate]
  );

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Tìm bạn</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Tìm bạn</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="mb-4">
            <Link to="/user/social/friends" className="btn btn-outline-primary btn-sm me-2">
              Danh sách bạn & lời mời
            </Link>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <h2 className="h5 mb-3" style={{ color: '#1e293b' }}>
                    Tìm kiếm
                  </h2>
                  <div className="btn-group mb-3" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${mode === 'exact' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setMode('exact');
                        setResults([]);
                      }}
                    >
                      Email / SĐT khớp 100%
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${mode === 'name' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => {
                        setMode('name');
                        setResults([]);
                      }}
                    >
                      Gợi ý theo tên
                    </button>
                  </div>

                  {mode === 'exact' && (
                    <div className="mb-3">
                      <label className="form-label small text-muted">Nhập đúng email hoặc số điện thoại</label>
                      <div className="input-group">
                        <input
                          className="form-control"
                          value={exactQuery}
                          onChange={(ev) => setExactQuery(ev.target.value)}
                          placeholder="vd: ban@email.com hoặc 090..."
                          onKeyDown={(ev) => ev.key === 'Enter' && runExact()}
                        />
                        <button type="button" className="btn btn-primary" disabled={searching} onClick={runExact}>
                          Tìm
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'name' && (
                    <div className="mb-3">
                      <label className="form-label small text-muted">Gõ tên — gợi ý cập nhật sau vài giây</label>
                      <input
                        className="form-control"
                        value={nameQuery}
                        onChange={(ev) => setNameQuery(ev.target.value)}
                        placeholder="Tên hiển thị…"
                      />
                    </div>
                  )}

                  {searching && <p className="text-muted small">Đang tìm…</p>}

                  <ul className="list-group list-group-flush">
                    {!searching && results.length === 0 && (mode === 'exact' ? exactQuery.trim() : nameDebounced).length > 0 && (
                      <li className="list-group-item text-muted border-0 px-0">Không có kết quả phù hợp.</li>
                    )}
                    {results.map((x) => {
                      const id = x.id ?? x.Id;
                      const name = x.fullName ?? x.FullName ?? '';
                      const av = x.avatarUrl ?? x.AvatarUrl;
                      return (
                        <li key={id} className="list-group-item border-0 border-bottom px-0 py-3">
                          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <Link
                              to={`/user/profile/${id}`}
                              className="d-flex align-items-center text-decoration-none"
                              style={{ color: '#1e293b' }}
                            >
                              {av ? (
                                <img
                                  src={av}
                                  alt=""
                                  className="rounded-circle me-2"
                                  style={{ width: 44, height: 44, objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center me-2"
                                  style={{ width: 44, height: 44, color: '#64748b' }}
                                >
                                  {name.charAt(0)}
                                </div>
                              )}
                              <strong>{name}</strong>
                            </Link>
                            <RelationshipActions
                              otherUserId={id}
                              chatPeerFullName={name}
                              chatPeerAvatarUrl={av}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h3 className="h6 mb-2" style={{ color: '#1e293b' }}>
                    Quét mã từ ảnh (máy tính)
                  </h3>
                  <p className="small text-muted mb-2">
                    Chọn ảnh chụp mã QR hồ sơ — hệ thống sẽ mở đúng trang nếu nhận diện được.
                  </p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={onQrFile} />
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                    Chọn ảnh QR
                  </button>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body text-center">
                  <h3 className="h6 mb-2" style={{ color: '#1e293b' }}>
                    Mã QR hồ sơ của bạn
                  </h3>
                  {shareUrl ? (
                    <>
                      <QRCodeSVG value={shareUrl} size={200} level="M" includeMargin />
                      <p className="small text-muted mt-2 mb-0 text-break">{shareUrl}</p>
                    </>
                  ) : (
                    <p className="small text-muted mb-0">Đăng nhập để tạo mã QR.</p>
                  )}
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h3 className="h6 mb-3" style={{ color: '#1e293b' }}>
                    Ai có thể tìm bạn?
                  </h3>
                  {!privacyLoaded ? (
                    <p className="small text-muted mb-0">Đang tải…</p>
                  ) : (
                    <>
                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="p-email"
                          checked={privacy.allowFindByEmail}
                          onChange={(ev) => setPrivacy((p) => ({ ...p, allowFindByEmail: ev.target.checked }))}
                        />
                        <label className="form-check-label small" htmlFor="p-email">
                          Cho phép tìm theo email (khớp 100%)
                        </label>
                      </div>
                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="p-phone"
                          checked={privacy.allowFindByPhone}
                          onChange={(ev) => setPrivacy((p) => ({ ...p, allowFindByPhone: ev.target.checked }))}
                        />
                        <label className="form-check-label small" htmlFor="p-phone">
                          Cho phép tìm theo số điện thoại (khớp 100%)
                        </label>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={savePrivacy}>
                        Lưu cài đặt
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import RelationshipActions from '../../components/user/RelationshipActions';
import socialApi from '../../api/socialApi';
import { useAuth } from '../../context/AuthContext';
import { buildProfileShareUrl, getProfileUserIdFromDecodedQr } from '../../utils/profileQr';
import { notifySuccess, notifyWarning, notifyInfo } from '../../hooks/useNotification';

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
        if (m) notifyInfo('Chưa tải được cài đặt riêng tư — bạn vẫn có thể tìm kiếm.');
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
      notifyWarning(e?.response?.data?.message || 'Không tìm được lúc này.');
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
          notifyWarning('Gợi ý tên chưa tải được — thử lại sau vài giây.');
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
      notifySuccess('Đã lưu cài đặt riêng tư.');
    } catch (e) {
      notifyWarning(e?.response?.data?.message || 'Chưa lưu được — thử lại nhé.');
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
            notifyWarning('Trình duyệt chưa hỗ trợ đọc ảnh này.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (!code?.data) {
            notifyInfo('Chưa đọc được mã trong ảnh — thử ảnh rõ hơn nhé.');
            return;
          }
          const uid = getProfileUserIdFromDecodedQr(code.data);
          if (!uid) {
            notifyInfo('Liên kết trong mã không thuộc hồ sơ ShuttleUp.');
            return;
          }
          navigate(`/user/profile/${uid}`);
        };
        img.onerror = () => notifyWarning('Không mở được file ảnh.');
        img.src = reader.result;
      };
      reader.onerror = () => notifyWarning('Không đọc được file.');
      reader.readAsDataURL(file);
    },
    [navigate]
  );

  const downloadQR = () => {
    const svg = document.getElementById('my-profile-qr');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `shuttleup_qr_${myId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-users text-emerald-600"></i>
              Tìm kiếm bạn bè
            </h2>
            <p className="text-slate-500 text-sm m-0">Gặp gỡ và kết nối với những người chơi cầu lông cùng đam mê.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/user/social/friends" className="btn btn-emerald-soft font-bold px-4 py-2.5">
              <i className="fa-solid fa-user-group" aria-hidden />
              <span>Bạn bè & Lời mời</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          {/* Search Box */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
              <h5 className="text-base font-bold text-slate-800 m-0">Công cụ tìm kiếm</h5>
            </div>

            <div className="flex p-1 bg-slate-50 rounded-xl mb-6 w-fit">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  mode === 'exact' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => {
                  setMode('exact');
                  setResults([]);
                }}
              >
                Theo Email / SĐT
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  mode === 'name' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => {
                  setMode('name');
                  setResults([]);
                }}
              >
                Gợi ý theo tên
              </button>
            </div>

            {mode === 'exact' ? (
              <div className="space-y-3">
                <div className="relative group">
                  <span
                    className="pointer-events-none absolute left-0 top-0 z-[1] flex h-full w-12 items-center justify-center text-slate-400"
                    aria-hidden
                  >
                    <i className="fa-solid fa-magnifying-glass text-[0.95rem]"></i>
                  </span>
                  <input
                    className="form-control user-social-exact-search-input rounded-[0.75rem] border-slate-200 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                    value={exactQuery}
                    onChange={(ev) => setExactQuery(ev.target.value)}
                    placeholder="Nhập chính xác email hoặc SĐT..."
                    onKeyDown={(ev) => ev.key === 'Enter' && runExact()}
                  />
                  <button
                    type="button"
                    className="btn btn-emerald absolute right-2 top-1/2 z-[2] -translate-y-1/2 px-4 py-1.5 text-sm font-bold transition-all disabled:opacity-50 border-0"
                    disabled={searching}
                    onClick={runExact}
                  >
                    {searching ? '...' : 'Tìm ngay'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative group">
                <span
                  className="pointer-events-none absolute left-0 top-0 z-[1] flex h-full w-12 items-center justify-center text-slate-400"
                  aria-hidden
                >
                  <i className="fa-solid fa-user-tag text-[0.95rem]"></i>
                </span>
                <input
                  className="form-control user-social-name-search-input rounded-[0.75rem] border-slate-200 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  value={nameQuery}
                  onChange={(ev) => setNameQuery(ev.target.value)}
                  placeholder="Nhập tên hiển thị bạn muốn tìm..."
                />
              </div>
            )}

            {searching && (
              <div className="mt-4 flex items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                  <i className="fa-solid fa-spinner fa-spin text-emerald-600"></i>
                  Đang tìm kiếm dữ liệu...
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {!searching && results.length === 0 && (mode === 'exact' ? exactQuery.trim() : nameDebounced).length > 0 && (
                <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                   <i className="fa-solid fa-user-slash text-slate-300 text-3xl mb-3"></i>
                   <p className="text-slate-400 font-medium m-0">Không tìm thấy ai phù hợp yêu cầu này.</p>
                </div>
              )}
              {results.map((x) => {
                const id = x.id ?? x.Id;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                return (
                  <div key={id} className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all group shadow-sm bg-white">
                    <div className="flex items-center justify-between gap-4">
                      <Link to={`/user/profile/${id}`} className="flex items-center gap-3 no-underline grow min-w-0">
                        <div className="relative shrink-0">
                          {av ? (
                            <img src={av} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl border-2 border-white shadow-sm">
                              {name.charAt(0)}
                            </div>
                          )}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <h6 className="text-[15px] font-bold text-slate-800 m-0 group-hover:text-emerald-700 transition-colors truncate">{name}</h6>
                          <p className="text-[12px] text-slate-400 m-0 flex items-center gap-1">
                            <i className="fa-solid fa-earth-asia text-[10px]"></i> Người đại diện phong trào
                          </p>
                        </div>
                      </Link>
                      <div className="shrink-0 flex items-center gap-2">
                        <RelationshipActions
                          otherUserId={id}
                          chatPeerFullName={name}
                          chatPeerAvatarUrl={av}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
             <div className="flex items-center gap-2 mb-4">
               <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
               <h5 className="text-base font-bold text-slate-800 m-0">Quét mã QR từ ảnh</h5>
             </div>
             <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
               Nếu bạn có ảnh chụp mã QR của đối phương trên thiết bị, bạn có thể tải lên để hệ thống tự động nhận diện và mở hồ sơ.
             </p>
             <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onQrFile} />
             <button
               type="button"
               className="btn btn-emerald-soft w-full px-6 py-2.5 font-bold md:w-auto"
               onClick={() => fileInputRef.current?.click()}
             >
               <i className="fa-solid fa-image" aria-hidden />
               <span>Chọn ảnh từ máy tính</span>
             </button>
          </div>
        </div>

        <div className="col-lg-5 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 text-center">
            <div className="flex items-center gap-2 mb-6 text-left">
              <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
              <h5 className="text-base font-bold text-slate-800 m-0">Mã QR cá nhân</h5>
            </div>
            {shareUrl ? (
              <div className="flex flex-col items-center">
                <div className="p-5 bg-emerald-50 rounded-3xl mb-4 border-4 border-white shadow-sm">
                  <QRCodeSVG id="my-profile-qr" value={shareUrl} size={180} level="M" includeMargin={false} fgColor="#065f46" />
                </div>
                <div className="bg-slate-50 rounded-xl px-4 py-2 mb-2 max-w-full">
                  <p className="text-[11px] text-slate-400 font-bold m-0 break-all">{shareUrl}</p>
                </div>
                <button type="button" className="btn btn-emerald-soft btn-sm font-bold shadow-sm mb-2" onClick={downloadQR}>
                  <i className="fa-solid fa-download" aria-hidden />
                  <span>Tải mã cá nhân</span>
                </button>
                <p className="text-xs text-slate-400 px-6">Đưa mã này cho bạn bè quét để họ tìm thấy bạn ngay lập tức.</p>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center">
                <i className="fa-solid fa-qrcode text-slate-200 text-5xl mb-4"></i>
                <p className="text-slate-400 font-medium text-sm">Vui lòng đăng nhập để xem mã QR.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-1 h-5 bg-emerald-500 rounded-full"></span>
              <h5 className="text-base font-bold text-slate-800 m-0">Quyền riêng tư</h5>
            </div>
            {!privacyLoaded ? (
              <div className="flex items-center gap-2 text-slate-400 py-4 font-semibold text-sm">
                 <i className="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...
              </div>
            ) : (
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    className="form-check-input mt-1 shadow-none border-slate-300 pointer-events-none appearance-none w-5 h-5 rounded-md checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer relative after:content-['\2713'] after:absolute after:hidden checked:after:block after:text-white after:text-[12px] after:left-1.5"
                    style={{ pointerEvents: 'auto' }}
                    type="checkbox"
                    id="p-email"
                    checked={privacy.allowFindByEmail}
                    onChange={(ev) => setPrivacy((p) => ({ ...p, allowFindByEmail: ev.target.checked }))}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">Tìm kiếm theo Email</span>
                    <span className="text-[11px] text-slate-400">Người khác có thể tìm thấy bạn nếu họ biết chính xác email.</span>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                  <input
                    className="form-check-input mt-1 shadow-none border-slate-300 pointer-events-none appearance-none w-5 h-5 rounded-md checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer relative after:content-['\2713'] after:absolute after:hidden checked:after:block after:text-white after:text-[12px] after:left-1.5"
                    style={{ pointerEvents: 'auto' }}
                    type="checkbox"
                    id="p-phone"
                    checked={privacy.allowFindByPhone}
                    onChange={(ev) => setPrivacy((p) => ({ ...p, allowFindByPhone: ev.target.checked }))}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">Tìm kiếm theo Số điện thoại</span>
                    <span className="text-[11px] text-slate-400">Người khác có thể tìm thấy bạn nếu họ biết chính xác SĐT.</span>
                  </div>
                </label>
                
                <button
                  type="button"
                  className="btn btn-emerald mt-4 w-full py-2.5 font-bold shadow-lg shadow-emerald-500/10"
                  onClick={savePrivacy}
                >
                  <i className="fa-solid fa-shield-check" aria-hidden />
                  <span>Lưu thiết lập của tôi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import { managerProfileApi } from '../../api/managerProfileApi';
import { useAuth } from '../../context/AuthContext';

export default function UserManagerInfo() {
  const { user } = useAuth();
  const isManager = user?.roles?.includes('MANAGER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [requestType, setRequestType] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    taxCode: '',
    address: '',
  });

  const [cccdFrontFile, setCccdFrontFile] = useState(null);
  const [cccdBackFile, setCccdBackFile] = useState(null);
  const [businessLicenseFiles, setBusinessLicenseFiles] = useState([]);

  // Docs hiện tại (đến từ BE: snapshot APPROVED hoặc request PENDING gần nhất)
  const [existingCccdFrontUrl, setExistingCccdFrontUrl] = useState(null);
  const [existingCccdBackUrl, setExistingCccdBackUrl] = useState(null);
  const [existingBusinessLicenseFiles, setExistingBusinessLicenseFiles] = useState([]);

  // Preview docs vừa chọn (objectURL từ File user mới upload)
  const [cccdFrontObjectUrl, setCccdFrontObjectUrl] = useState(null);
  const [cccdBackObjectUrl, setCccdBackObjectUrl] = useState(null);
  const [businessLicenseObjectPreviews, setBusinessLicenseObjectPreviews] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr('');
      setFieldErrors({});
      try {
        const data = await managerProfileApi.getMe();
        if (!mounted) return;
        setStatus(data.status ?? data.Status ?? null);
        setRequestType(data.requestType ?? data.RequestType ?? null);
        setForm({
          taxCode: data.taxCode ?? data.TaxCode ?? '',
          address: data.address ?? data.Address ?? '',
        });
        setExistingCccdFrontUrl(data.cccdFrontUrl ?? null);
        setExistingCccdBackUrl(data.cccdBackUrl ?? null);
        setExistingBusinessLicenseFiles(data.businessLicenseFiles ?? []);
      } catch {
        // user có thể chưa đăng ký manager → giữ trạng thái null
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!cccdFrontFile) {
      setCccdFrontObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(cccdFrontFile);
    setCccdFrontObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cccdFrontFile]);

  useEffect(() => {
    if (!cccdBackFile) {
      setCccdBackObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(cccdBackFile);
    setCccdBackObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cccdBackFile]);

  useEffect(() => {
    if (!businessLicenseFiles || businessLicenseFiles.length === 0) {
      setBusinessLicenseObjectPreviews([]);
      return;
    }
    const previews = businessLicenseFiles.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      mimeType: f.type,
      id: null,
    }));
    setBusinessLicenseObjectPreviews(previews);
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [businessLicenseFiles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const requireFullName = () => {
    const fullName = (user?.fullName || '').trim();
    if (!fullName) {
      setErr('Bạn nhớ cập nhật Họ và tên ở tab Hồ sơ trước khi gửi đơn cho Admin duyệt nhé!');
      return false;
    }
    return true;
  };

  const validateManagerFields = () => {
    const req = (requestType || '').toString().toUpperCase();
    const isRegistration = !req || req === 'DANG_KY';

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    const newErrors = {};

    if (isRegistration) {
      if (!form.taxCode?.trim()) newErrors.taxCode = 'Bạn chưa nhập Mã số thuế.';
      if (!form.address?.trim()) newErrors.address = 'Bạn chưa nhập Địa chỉ.';
      if (!effectiveCccdFront) newErrors.cccdFrontFile = 'Bạn chưa tải lên CCCD mặt trước.';
      if (!effectiveCccdBack) newErrors.cccdBackFile = 'Bạn chưa tải lên CCCD mặt sau.';
      if (licenseCountEffective <= 0) newErrors.businessLicenseFiles = 'Bạn cần tải lên ít nhất 1 Giấy phép kinh doanh.';
    } else {
      // CAP_NHAT: cho phép không bắt buộc CCCD/giấy phép
      const hasTaxOrAddress = !!(form.taxCode?.trim() || form.address?.trim());
      const hasAnyNewFile = !!(cccdFrontFile || cccdBackFile || (businessLicenseFiles?.length ?? 0) > 0);
      if (!hasTaxOrAddress && !hasAnyNewFile) {
        setErr('Bạn điền thêm vài thông tin cập nhật (Mã số thuế/Địa chỉ hoặc upload giấy tờ) nha.');
        return false;
      }

      // Nếu user chọn 1 mặt CCCD thì cần chọn đủ 2 mặt
      if (cccdFrontFile && !cccdBackFile) newErrors.cccdBackFile = 'Bạn cần chọn thêm CCCD mặt sau.';
      if (cccdBackFile && !cccdFrontFile) newErrors.cccdFrontFile = 'Bạn cần chọn thêm CCCD mặt trước.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return false;
    }
    return true;
  };

  const canSubmit = useMemo(() => {
    if (saving || loading) return false;
    if (!(user?.fullName || '').trim()) return false;
    const req = (requestType || '').toString().toUpperCase();
    const isRegistration = !req || req === 'DANG_KY';

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    if (isRegistration) {
      return !!(
        form.taxCode?.trim() &&
        form.address?.trim() &&
        effectiveCccdFront &&
        effectiveCccdBack &&
        licenseCountEffective > 0
      );
    }

    // CAP_NHAT: chỉ cần có thông tin cập nhật + không chọn thiếu CCCD 2 mặt
    if (cccdFrontFile && !cccdBackFile) return false;
    if (cccdBackFile && !cccdFrontFile) return false;

    return !!(
      form.taxCode?.trim() ||
      form.address?.trim() ||
      cccdFrontFile ||
      cccdBackFile ||
      (businessLicenseFiles?.length ?? 0) > 0
    );
  }, [
    saving,
    loading,
    user?.fullName,
    form,
    requestType,
    cccdFrontFile,
    cccdBackFile,
    businessLicenseFiles,
    existingCccdFrontUrl,
    existingCccdBackUrl,
    existingBusinessLicenseFiles
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setFieldErrors({});
    if (!requireFullName()) return;
    if (!validateManagerFields()) return;

    setSaving(true);
    try {
      const res = await managerProfileApi.updateMe({
        taxCode: form.taxCode?.trim() || null,
        address: form.address?.trim() || null,
        cccdFrontFile,
        cccdBackFile,
        businessLicenseFiles
      });
      // Refresh để hiển thị docs vừa upload (kể cả khi PENDING chưa duyệt)
      const data = await managerProfileApi.getMe();
      setStatus(data.status ?? data.Status ?? null);
      setRequestType(data.requestType ?? data.RequestType ?? null);
      setForm({
        taxCode: data.taxCode ?? data.TaxCode ?? '',
        address: data.address ?? data.Address ?? '',
      });
      setExistingCccdFrontUrl(data.cccdFrontUrl ?? null);
      setExistingCccdBackUrl(data.cccdBackUrl ?? null);
      setExistingBusinessLicenseFiles(data.businessLicenseFiles ?? []);

      setMsg('Tuyệt vời! Đã gửi thông tin Quản lý. Vui lòng chờ Admin duyệt nha.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Oops... Gửi đơn thất bại, bạn thử lại nhé!');
    } finally {
      setSaving(false);
    }
  };

  const badge = (() => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">APPROVED</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">REJECTED</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">PENDING</span>;
    return isManager
      ? <span className="badge bg-success">ĐÃ ĐĂNG KÝ</span>
      : <span className="badge bg-secondary">CHƯA ĐĂNG KÝ</span>;
  })();

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-file-signature text-emerald-600"></i>
              Thông tin Quản lý
            </h2>
            <p className="text-slate-500 text-sm m-0">Quản lý hồ sơ doanh nghiệp và trạng thái cộng tác viên.</p>
          </div>
          <div className="flex gap-2">
            <div className={`px-4 py-2 rounded-xl border font-bold text-sm shadow-sm flex items-center gap-2 ${
              (status || '').toUpperCase() === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
              (status || '').toUpperCase() === 'REJECTED' ? 'bg-rose-50 border-rose-100 text-rose-700' :
              (status || '').toUpperCase() === 'PENDING' ? 'bg-amber-50 border-amber-100 text-amber-700' :
              'bg-slate-50 border-slate-100 text-slate-600'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                (status || '').toUpperCase() === 'APPROVED' ? 'bg-emerald-500' :
                (status || '').toUpperCase() === 'REJECTED' ? 'bg-rose-500' :
                (status || '').toUpperCase() === 'PENDING' ? 'bg-amber-500' :
                'bg-slate-400'
              }`}></span>
              {status ? status.toUpperCase() : (isManager ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ')}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {err && (
            <div className="alert alert-danger rounded-xl border-0 shadow-sm flex items-center gap-3 bg-rose-50 text-rose-700 py-3 px-4 mb-6">
              <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
              <span className="font-semibold text-sm">{err}</span>
            </div>
          )}
          {msg && (
            <div className="alert alert-success rounded-xl border-0 shadow-sm flex items-center gap-3 bg-emerald-50 text-emerald-700 py-3 px-4 mb-6">
              <i className="fa-solid fa-circle-check text-emerald-500"></i>
              <span className="font-semibold text-sm">{msg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-3xl"></i>
              <p className="text-slate-400 font-medium">Đang tải hồ sơ của bạn...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CCCD Front */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="fa-solid fa-id-card text-emerald-500 text-sm"></i>
                    <h5 className="text-[15px] font-bold text-slate-800 m-0">CCCD mặt trước</h5>
                  </div>
                  <div className={`relative group border-2 border-dashed rounded-2xl p-4 transition-all ${fieldErrors.cccdFrontFile ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        setCccdFrontFile(e.target.files?.[0] ?? null);
                        if (fieldErrors.cccdFrontFile) setFieldErrors(prev => ({ ...prev, cccdFrontFile: '' }));
                      }}
                    />
                    <div className="flex flex-col items-center text-center py-4">
                      {cccdFrontObjectUrl || existingCccdFrontUrl ? (
                         <div className="relative w-full aspect-[1.6/1] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                            <img
                              src={cccdFrontObjectUrl || existingCccdFrontUrl}
                              alt="CCCD Front"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <span className="text-white text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/30">Thay đổi ảnh</span>
                            </div>
                         </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 mb-2 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                            <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                          </div>
                          <span className="text-[13px] font-bold text-slate-600">Bấm hoặc kéo thả ảnh</span>
                          <span className="text-[11px] text-slate-400 mt-1">Chụp rõ nét mặt trước CCCD</span>
                        </>
                      )}
                    </div>
                  </div>
                  {fieldErrors.cccdFrontFile && <div className="text-rose-500 text-[11px] font-bold px-1">{fieldErrors.cccdFrontFile}</div>}
                </div>

                {/* CCCD Back */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="fa-solid fa-id-card text-emerald-500 text-sm"></i>
                    <h5 className="text-[15px] font-bold text-slate-800 m-0">CCCD mặt sau</h5>
                  </div>
                  <div className={`relative group border-2 border-dashed rounded-2xl p-4 transition-all ${fieldErrors.cccdBackFile ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        setCccdBackFile(e.target.files?.[0] ?? null);
                        if (fieldErrors.cccdBackFile) setFieldErrors(prev => ({ ...prev, cccdBackFile: '' }));
                      }}
                    />
                    <div className="flex flex-col items-center text-center py-4">
                      {cccdBackObjectUrl || existingCccdBackUrl ? (
                         <div className="relative w-full aspect-[1.6/1] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                            <img
                              src={cccdBackObjectUrl || existingCccdBackUrl}
                              alt="CCCD Back"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <span className="text-white text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/30">Thay đổi ảnh</span>
                            </div>
                         </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 mb-2 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                            <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                          </div>
                          <span className="text-[13px] font-bold text-slate-600">Bấm hoặc kéo thả ảnh</span>
                          <span className="text-[11px] text-slate-400 mt-1">Chụp rõ nét mặt sau CCCD</span>
                        </>
                      )}
                    </div>
                  </div>
                  {fieldErrors.cccdBackFile && <div className="text-rose-500 text-[11px] font-bold px-1">{fieldErrors.cccdBackFile}</div>}
                </div>
              </div>

              {/* Tax & Business License */}
              <div className="space-y-6 pt-6 border-t border-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="md:col-span-1 space-y-2">
                      <label className="text-[13px] font-bold text-slate-600 px-1">Mã số thuế</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <i className="fa-solid fa-building-circle-check text-xs"></i>
                        </div>
                        <input
                          type="text"
                          className="form-control rounded-xl border-slate-200 py-3 pl-10 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all px-4 font-bold text-slate-700"
                          name="taxCode"
                          value={form.taxCode}
                          onChange={handleChange}
                          placeholder="Mã số thuế..."
                        />
                      </div>
                      {fieldErrors.taxCode && <div className="text-rose-500 text-[11px] font-bold px-1">{fieldErrors.taxCode}</div>}
                   </div>

                   <div className="md:col-span-2 space-y-2">
                      <label className="text-[13px] font-bold text-slate-600 px-1">Địa chỉ doanh nghiệp / cá nhân</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          <i className="fa-solid fa-location-dot text-xs"></i>
                        </div>
                        <input
                          type="text"
                          className="form-control rounded-xl border-slate-200 py-3 pl-10 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all px-4 font-medium"
                          name="address"
                          value={form.address}
                          onChange={handleChange}
                          placeholder="Địa chỉ đăng ký kinh doanh..."
                        />
                      </div>
                      {fieldErrors.address && <div className="text-rose-500 text-[11px] font-bold px-1">{fieldErrors.address}</div>}
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-file-contract text-emerald-500 text-sm"></i>
                      <h5 className="text-[15px] font-bold text-slate-800 m-0">Giấy phép kinh doanh (Tối đa 3 file)</h5>
                   </div>
                   
                   <div className={`relative group border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center text-center ${fieldErrors.businessLicenseFiles ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}>
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        accept="image/png,image/jpeg,application/pdf"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length > 3) {
                            setErr('Chỉ được tải lên tối đa 3 file giấy phép kinh doanh thôi nha.');
                            setBusinessLicenseFiles(files.slice(0, 3));
                            return;
                          }
                          setBusinessLicenseFiles(files);
                          if (fieldErrors.businessLicenseFiles && files.length > 0) setFieldErrors(p => ({ ...p, businessLicenseFiles: '' }));
                          setErr('');
                        }}
                      />
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mb-4 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                        <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                      </div>
                      <p className="text-slate-600 font-bold m-0">Chọn hoặc kéo thả các tài liệu kinh doanh</p>
                      <p className="text-[12px] text-slate-400 mt-1">Chấp nhận JPG, PNG, PDF (Tối đa 5MB mỗi file)</p>
                   </div>
                   {fieldErrors.businessLicenseFiles && <div className="text-rose-500 text-[11px] font-bold text-center">{fieldErrors.businessLicenseFiles}</div>}

                   {((businessLicenseObjectPreviews && businessLicenseObjectPreviews.length > 0) ||
                                 (existingBusinessLicenseFiles && existingBusinessLicenseFiles.length > 0)) && (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                        {(businessLicenseObjectPreviews?.length > 0
                          ? businessLicenseObjectPreviews
                          : existingBusinessLicenseFiles
                        ).map((f, idx) => {
                          const mime = f.mimeType || f.MimeType || '';
                          const isImg = (mime || '').toString().startsWith('image/');
                          return (
                            <div key={f.id ?? `${f.name ?? 'file'}_${idx}`} className="group relative bg-slate-50 rounded-xl p-2 border border-slate-100">
                               <div className="aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center mb-2 shadow-sm">
                                  {isImg ? (
                                    <img src={f.url} className="w-full h-full object-cover" alt="license" />
                                  ) : (
                                    <i className="fa-solid fa-file-pdf text-3xl text-rose-500"></i>
                                  )}
                               </div>
                               <div className="px-1 overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-600 truncate mb-1">{f.name || 'document_' + (idx+1)}</p>
                                  {!isImg && (
                                    <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 font-bold no-underline">XEM CHI TIẾT <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i></a>
                                  )}
                               </div>
                            </div>
                          );
                        })}
                     </div>
                   )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-8 border-t border-slate-50 mt-10">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 px-10 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all gap-2 border-0 disabled:opacity-50 disabled:shadow-none"
                >
                  {saving ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Đang xử lý</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane"></i> Gửi / Cập nhật thông tin</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


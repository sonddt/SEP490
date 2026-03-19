import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'MB Bank',
  'ACB', 'Sacombank', 'VP Bank', 'TPBank', 'HD Bank',
  'SHB', 'OCB', 'SeABank', 'LPBank', 'Eximbank', 'Khác',
];

export default function ManagerPaymentSettings() {
  const { user } = useAuth();
  
  // State for config
  const [form, setForm] = useState({
    bankName: 'Vietcombank',
    accountNumber: '0123456789',
    accountHolder: 'NGUYEN VAN A',
    vnpayEnabled: true,
    vnpayMerchantId: '',
  });
  
  const [qrCodeImg, setQrCodeImg] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // max 2MB as per screenshot
        alert("Ảnh không được vượt quá 2MB");
        return;
      }
      setQrCodeImg(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setQrPreview(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeQr = () => {
    setQrCodeImg(null);
    setQrPreview(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      
      const toast = document.createElement('div');
      toast.className = 'bk-toast bk-toast--success';
      toast.innerHTML = `<i class="feather-check-circle"></i> Đã lưu thông tin thanh toán!`;
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.zIndex = '9999';
      document.body.appendChild(toast);
      
      setTimeout(() => toast.remove(), 3000);
    }, 800);
  };

  // Custom input style to match screenshot
  const inputStyle = {
    background: '#f8fafc', 
    border: 'none', 
    borderRadius: '8px', 
    padding: '12px 16px',
    boxShadow: 'none'
  };

  return (
    <div className="mgr-page">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="mb-1" style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
            Cài đặt thanh toán
          </h1>
          <p className="text-muted mb-0">
            Cập nhật tài khoản ngân hàng và mã QR (VNPay/VietQR).
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="row g-4 d-flex align-items-stretch">
          {/* Settings Form Column */}
          <div className="col-xl-8 col-lg-7 d-flex flex-column gap-4">
            
            {/* Info notice */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="feather-info" style={{ color: '#3b82f6', fontSize: 17, flexShrink: 0 }} />
              <div style={{ fontSize: 14, color: '#1e40af' }}>
                Cài đặt thanh toán này áp dụng cho <strong>tất cả cụm sân</strong> của bạn. Người chơi sẽ thấy thông tin này khi thanh toán đặt sân.
              </div>
            </div>

            <div className="row g-4 flex-grow-1">
              {/* Bank Transfer */}
              <div className="col-md-6 d-flex flex-column">
                <div className="card flex-grow-1 border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="feather-credit-card" style={{ color: '#097E52', fontSize: 20 }} />
                      </div>
                      <div>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Chuyển khoản ngân hàng</h5>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Thông tin tài khoản cho người chơi</span>
                      </div>
                    </div>
                    <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                  </div>
                  <div className="card-body pt-4">
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Ngân hàng <span className="text-danger">*</span>
                      </label>
                      <select className="form-select" style={inputStyle} value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} required>
                        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Số tài khoản <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control" style={inputStyle} placeholder="Ví dụ: 0123456789" value={form.accountNumber} onChange={(e) => setField('accountNumber', e.target.value)} required />
                    </div>
                    <div className="mb-2">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Chủ tài khoản <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control text-uppercase" style={inputStyle} placeholder="NGUYEN VAN A" value={form.accountHolder} onChange={(e) => setField('accountHolder', e.target.value.toUpperCase())} required />
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Upload */}
              <div className="col-md-6 d-flex flex-column">
                <div className="card flex-grow-1 border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="feather-image" style={{ color: '#2563eb', fontSize: 20 }} />
                      </div>
                      <div>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Mã QR thanh toán</h5>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Quét nhanh từ app ngân hàng</span>
                      </div>
                    </div>
                    <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                  </div>
                  <div className="card-body pt-4">
                    {qrPreview ? (
                      <div className="text-center w-100 d-flex flex-column align-items-center">
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={qrPreview} alt="QR Code" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, border: '1px solid #e2e8f0', padding: 8, background: '#fff' }} />
                          <button
                            type="button"
                            onClick={removeQr}
                            style={{ position: 'absolute', top: -10, right: -10, width: 30, height: 30, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}
                          >
                            <i className="feather-x" />
                          </button>
                        </div>
                        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 14 }}>Nhấn nút đỏ để xoá và upload lại</p>
                      </div>
                    ) : (
                      <div 
                        className="d-flex flex-column align-items-center justify-content-center text-center w-100 h-100" 
                        style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '40px 20px', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s', minHeight: '260px' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                         <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                           <i className="feather-upload-cloud" style={{ color: '#16a34a', fontSize: 20 }} />
                         </div>
                         <h6 style={{ fontSize: 14, color: '#475569', marginBottom: 6 }}>Kéo thả hoặc nhấn để chọn ảnh</h6>
                         <span style={{ fontSize: 12, color: '#94a3b8' }}>PNG, JPG — tối đa 2MB</span>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="d-none" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} />
                  </div>
                </div>
              </div>
              
              {/* VNPay Card */}
              <div className="col-12">
                <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-4">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3">
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="feather-zap" style={{ color: '#f59e0b', fontSize: 20 }} />
                        </div>
                        <div>
                          <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>VNPay (Tùy chọn)</h5>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>Thanh toán trực tuyến qua cổng VNPay</span>
                        </div>
                      </div>
                      
                      {/* Custom Toggle Switch */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <span style={{ fontSize: 14, color: form.vnpayEnabled ? '#097E52' : '#94a3b8', fontWeight: 600, transition: 'color .15s' }}>
                          {form.vnpayEnabled ? 'Đang bật' : 'Đang tắt'}
                        </span>
                        <div
                          onClick={() => setField('vnpayEnabled', !form.vnpayEnabled)}
                          style={{
                            width: 52, height: 28, borderRadius: 14, position: 'relative', cursor: 'pointer',
                            background: form.vnpayEnabled ? '#097E52' : '#cbd5e1', transition: 'background .2s',
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 3, left: form.vnpayEnabled ? 27 : 3,
                            transition: 'left .3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                          }} />
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {form.vnpayEnabled && (
                    <div className="card-body pt-0 pb-4">
                       <hr className="mt-0 mb-4" style={{ borderColor: '#f1f5f9' }} />
                       <div className="row">
                          <div className="col-md-6">
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Mã Merchant (VNPay)</label>
                            <input type="text" className="form-control" style={inputStyle} placeholder="Nhập mã merchant ID" value={form.vnpayMerchantId} onChange={(e) => setField('vnpayMerchantId', e.target.value)} />
                            <small className="text-muted" style={{ marginTop: 6, display: 'block', fontSize: 12 }}>Liên hệ VNPay để được cấp mã</small>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Save Button floating on the left side below cards */}
              <div className="col-12 mt-2">
                <button type="submit" className="btn btn-primary px-4 py-2" style={{ borderRadius: 8, fontSize: 15, fontWeight: 500 }} disabled={submitting}>
                  {submitting ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  ) : (
                    <i className="feather-save me-2"></i>
                  )}
                  Lưu cài đặt
                </button>
              </div>

            </div>
          </div>
          
          {/* Live Preview Panel Column */}
          <div className="col-xl-4 col-lg-5">
            <div className="card shadow-sm border-0" style={{ position: 'sticky', top: '24px', borderRadius: 12 }}>
              <div className="card-header border-0 bg-transparent pt-4 pb-0 text-center">
                <h4 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Xem trước hiển thị</h4>
              </div>
              <div className="card-body pt-3">
                <p className="text-muted text-center" style={{ fontSize: '13px', marginBottom: 20 }}>
                  Người dùng sẽ nhìn thấy thông tin này khi thanh toán đặt sân:
                </p>
                
                <div className="p-4 rounded-3 d-flex flex-column align-items-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="text-center mb-3">
                    <div className="bg-white p-3 rounded-4 d-inline-block shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
                      <img src={qrPreview || '/assets/img/qr-placeholder.png'} alt="QR" style={{ width: '130px', height: '130px', objectFit: 'contain' }} onError={(e) => { e.target.src = '/assets/img/qr-placeholder.png'; }} />
                    </div>
                  </div>
                  
                  <div className="mt-3 text-center" style={{ fontSize: '14px', color: '#166534', width: '100%' }}>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Ngân hàng:</span> 
                      <strong className="text-end">{form.bankName || '...'}</strong>
                    </div>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Số tài khoản:</span> 
                      <strong className="text-end">{form.accountNumber || '...'}</strong>
                    </div>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Chủ TK:</span> 
                      <strong className="text-end">{form.accountHolder || '...'}</strong>
                    </div>
                    
                    <hr className="my-3 mx-auto" style={{ width: '80%', borderColor: '#bbf7d0' }} />
                    
                    <div className="mb-2 text-muted" style={{ fontSize: '13px', color: '#14532d' }}>
                      Số tiền: <strong className="fs-6 d-block mt-1" style={{ color: '#097E52' }}>250.000 ₫</strong>
                    </div>
                    <div className="text-muted" style={{ fontSize: '12px', color: '#14532d' }}>
                      Nội dung CK: <strong className="d-block mt-1" style={{ background: '#dcfce7', padding: '4px 8px', borderRadius: 6, display: 'inline-block', color: '#166534' }}>[SĐT] - [Tên sân] - [Ngày]</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </form>
    </div>
  );
}

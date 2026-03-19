import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ManagerPaymentSettings() {
  const { user } = useAuth();
  
  // State for config
  const [bankName, setBankName] = useState('Vietcombank');
  const [accNumber, setAccNumber] = useState('123456789012');
  const [accName, setAccName] = useState('SHUTTLEUP BADMINTON');
  const [qrCodeImg, setQrCodeImg] = useState('/assets/img/qr-placeholder.png');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // max 10MB
        alert("Ảnh không được vượt quá 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setQrCodeImg(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      
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

  return (
    <div className="mgr-page">
      {/* Top Banner/Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="mb-1" style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
            Cài đặt thanh toán
          </h1>
          <p className="text-muted mb-0">
            Cập nhật tài khoản ngân hàng và mã QR (VNPay/VietQR) để khách hàng chuyển khoản khi đặt sân.
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Settings Form */}
        <div className="col-xl-8 col-lg-7">
          <form className="card card-tableset" onSubmit={handleSave}>
            <div className="card-header pb-0 border-0">
              <h4 className="mb-0">Thông tin Ngân hàng</h4>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Ngân hàng</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="VD: Vietcombank, TPBank..." 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Chủ tài khoản</label>
                  <input 
                    type="text" 
                    className="form-control text-uppercase" 
                    placeholder="Tên in trên thẻ" 
                    value={accName}
                    onChange={(e) => setAccName(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Số tài khoản</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Nhập số tài khoản" 
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <hr className="my-4" style={{ borderColor: 'var(--mgr-border)' }} />

              <h4 className="mb-3">Mã QR Thanh toán</h4>
              <p className="text-muted" style={{ fontSize: '13.5px' }}>
                Tải lên mã QR VNPay hoặc VietQR của bạn. Hệ thống sẽ tự động hiển thị mã này ở bước thanh toán của người chơi.
              </p>

              <div className="d-flex flex-column align-items-start gap-3 mt-3">
                <div 
                  className="rounded-3 border d-flex align-items-center justify-content-center overflow-hidden" 
                  style={{ width: '200px', height: '200px', background: '#f8fafc', borderColor: '#e2e8f0' }}
                >
                  <img 
                    src={qrCodeImg} 
                    alt="QR Code" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} 
                    onError={(e) => { e.target.src = '/assets/img/qr-placeholder.png'; }}
                  />
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="d-none" 
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                />
                
                <div className="d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="feather-upload"></i> Chọn ảnh QR
                  </button>
                  {qrCodeImg !== '/assets/img/qr-placeholder.png' && (
                    <button 
                      type="button" 
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setQrCodeImg('/assets/img/qr-placeholder.png')}
                      title="Xoá ảnh"
                    >
                      <i className="feather-trash-2 m-0"></i>
                    </button>
                  )}
                </div>
                <small className="text-muted">Định dạng hỗ trợ: JPG, PNG. Tối đa 10MB.</small>
              </div>
            </div>

            <div className="card-footer d-flex justify-content-end gap-2 bg-white pt-0 border-0 mt-2 pb-4 px-4">
              <button type="button" className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
                Huỷ
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ) : (
                  <i className="feather-save me-2"></i>
                )}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>

        {/* Preview Panel */}
        <div className="col-xl-4 col-lg-5">
          <div className="card card-tableset" style={{ position: 'sticky', top: '24px' }}>
            <div className="card-header pb-0 border-0">
              <h4 className="mb-0">Xem trước hiển thị</h4>
            </div>
            <div className="card-body">
              <p className="text-muted" style={{ fontSize: '13px' }}>
                Người dùng sẽ nhìn thấy thông tin này khi thanh toán đặt sân:
              </p>
              
              <div className="p-4 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="text-center mb-3">
                  <div className="bg-white p-2 rounded-3 d-inline-block shadow-sm">
                    <img src={qrCodeImg} alt="QR" style={{ width: '120px', height: '120px', objectFit: 'contain' }} onError={(e) => { e.target.src = '/assets/img/qr-placeholder.png'; }} />
                  </div>
                </div>
                
                <div className="mt-3 text-center" style={{ fontSize: '13px', color: '#166534' }}>
                  <div className="mb-1"><strong>Ngân hàng:</strong> {bankName || '...'}</div>
                  <div className="mb-1"><strong>Số tài khoản:</strong> {accNumber || '...'}</div>
                  <div className="mb-1"><strong>Chủ TK:</strong> {accName || '...'}</div>
                  <div className="mt-2 text-muted" style={{ fontSize: '12px' }}>Số tiền: <strong className="text-dark">250.000 ₫</strong></div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>Nội dung CK: <strong className="text-dark">[SĐT] - [Tên sân] - [Ngày]</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

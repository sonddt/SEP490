import { useState } from 'react';

const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'MB Bank',
  'ACB', 'Sacombank', 'VP Bank', 'TPBank', 'HD Bank',
  'SHB', 'OCB', 'SeABank', 'LPBank', 'Eximbank', 'Khác',
];

export default function ManagerPaymentSettings() {
  const [form, setForm] = useState({
    bankName: 'Vietcombank',
    accountNumber: '',
    accountHolder: '',
    vnpayEnabled: false,
    vnpayMerchantId: '',
  });
  const [qrImage, setQrImage] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, val) => {
    setSaved(false);
    setForm((p) => ({ ...p, [key]: val }));
  };

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrImage(file);
    setQrPreview(URL.createObjectURL(file));
    setSaved(false);
  };

  const removeQr = () => {
    setQrImage(null);
    setQrPreview(null);
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      console.log('Save payment settings:', { ...form, qrImage });
      setSaved(true);
      setSubmitting(false);
    }, 600);
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* Info notice */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <i className="feather-info" style={{ color: '#3b82f6', fontSize: 17, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 14, color: '#1e40af' }}>
          Cài đặt thanh toán này áp dụng cho <strong>tất cả cụm sân</strong> của bạn.
          Người chơi sẽ thấy thông tin này khi thanh toán đặt sân.
        </div>
      </div>

      {/* Success banner */}
      {saved && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, animation: 'bkToastIn 0.3s ease' }}>
          <i className="feather-check-circle" style={{ color: '#059669', fontSize: 18 }} />
          <span style={{ fontSize: 14, color: '#065f46', fontWeight: 500 }}>Đã lưu cài đặt thanh toán thành công!</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          {/* Bank Transfer */}
          <div className="col-lg-6">
            <div className="card border-0 h-100">
              <div className="card-header">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="feather-credit-card" style={{ color: '#097E52', fontSize: 18 }} />
                  </div>
                  <div>
                    <h5 style={{ margin: 0 }}>Chuyển khoản ngân hàng</h5>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Thông tin tài khoản cho người chơi</span>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Ngân hàng <span className="text-danger">*</span></label>
                  <select className="form-select" value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} required>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Số tài khoản <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" placeholder="Ví dụ: 0123456789" value={form.accountNumber} onChange={(e) => setField('accountNumber', e.target.value)} required />
                </div>
                <div className="mb-0">
                  <label className="form-label">Chủ tài khoản <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" placeholder="NGUYEN VAN A" value={form.accountHolder} onChange={(e) => setField('accountHolder', e.target.value.toUpperCase())} required />
                </div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="col-lg-6">
            <div className="card border-0 h-100">
              <div className="card-header">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="feather-image" style={{ color: '#2563eb', fontSize: 18 }} />
                  </div>
                  <div>
                    <h5 style={{ margin: 0 }}>Mã QR thanh toán</h5>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Quét nhanh từ app ngân hàng</span>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {qrPreview ? (
                  <div className="text-center">
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={qrPreview} alt="QR Code" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                      <button
                        type="button"
                        onClick={removeQr}
                        style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}
                      >
                        <i className="feather-x" />
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 10 }}>Nhấn nút đỏ để xoá và upload lại</p>
                  </div>
                ) : (
                  <div className="mgr-qr-upload">
                    <div className="mgr-qr-upload__icon">
                      <i className="feather-upload-cloud" />
                    </div>
                    <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>Kéo thả hoặc nhấn để chọn ảnh</p>
                    <small style={{ color: '#94a3b8' }}>PNG, JPG — tối đa 2MB</small>
                    <input type="file" accept="image/*" onChange={handleQrUpload} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VNPay */}
          <div className="col-12">
            <div className="card border-0">
              <div className="card-header">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="feather-zap" style={{ color: '#f59e0b', fontSize: 18 }} />
                    </div>
                    <div>
                      <h5 style={{ margin: 0 }}>VNPay (Tùy chọn)</h5>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Thanh toán trực tuyến qua cổng VNPay</span>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: form.vnpayEnabled ? '#097E52' : '#94a3b8', fontWeight: 500, transition: 'color .15s' }}>
                      {form.vnpayEnabled ? 'Đang bật' : 'Đang tắt'}
                    </span>
                    <div
                      onClick={() => setField('vnpayEnabled', !form.vnpayEnabled)}
                      style={{
                        width: 48, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer',
                        background: form.vnpayEnabled ? '#097E52' : '#cbd5e1', transition: 'background .2s',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3, left: form.vnpayEnabled ? 25 : 3,
                        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                      }} />
                    </div>
                  </label>
                </div>
              </div>
              {form.vnpayEnabled && (
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <label className="form-label">Mã Merchant (VNPay)</label>
                      <input type="text" className="form-control" placeholder="Nhập mã merchant ID" value={form.vnpayMerchantId} onChange={(e) => setField('vnpayMerchantId', e.target.value)} />
                      <small className="text-muted" style={{ marginTop: 4, display: 'block' }}>Liên hệ VNPay để được cấp mã</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="d-flex gap-3 mt-4">
          <button type="submit" className="btn btn-secondary" disabled={submitting}>
            {submitting ? (
              <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> Đang lưu...</>
            ) : (
              <><i className="feather-save" /> Lưu cài đặt</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

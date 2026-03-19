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
    console.log('Save payment settings:', { ...form, qrImage });
    setSaved(true);
  };

  return (
    <>
      {saved && (
        <div className="alert alert-success d-flex align-items-center mb-4" role="alert">
          <i className="feather-check-circle me-2" />
          Đã lưu cài đặt thanh toán thành công!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          {/* Bank Transfer */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <i className="feather-credit-card" style={{ color: 'var(--mgr-accent)' }} />
                  <h5 className="mb-0" style={{ fontSize: 16 }}>Chuyển khoản ngân hàng</h5>
                </div>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                  Thông tin tài khoản này sẽ hiển thị cho người chơi khi thanh toán đặt sân.
                </p>
                <div className="mb-3">
                  <label className="form-label">Ngân hàng <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={form.bankName}
                    onChange={(e) => setField('bankName', e.target.value)}
                    required
                  >
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Số tài khoản <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ví dụ: 0123456789"
                    value={form.accountNumber}
                    onChange={(e) => setField('accountNumber', e.target.value)}
                    required
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Chủ tài khoản <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="NGUYEN VAN A"
                    value={form.accountHolder}
                    onChange={(e) => setField('accountHolder', e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <i className="feather-image" style={{ color: 'var(--mgr-accent)' }} />
                  <h5 className="mb-0" style={{ fontSize: 16 }}>Mã QR thanh toán</h5>
                </div>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                  Upload mã QR từ ứng dụng ngân hàng để người chơi quét thanh toán nhanh.
                </p>

                {qrPreview ? (
                  <div className="text-center">
                    <img
                      src={qrPreview}
                      alt="QR Code"
                      style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, border: '1px solid #e2e8f0' }}
                    />
                    <div className="mt-3">
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeQr}>
                        <i className="feather-trash-2 me-1" />Xoá ảnh
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed #cbd5e1', borderRadius: 12,
                      padding: 32, textAlign: 'center', position: 'relative',
                      cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--mgr-accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                  >
                    <i className="feather-upload" style={{ fontSize: 32, color: '#94a3b8' }} />
                    <p className="text-muted mt-2 mb-1" style={{ fontSize: 14 }}>Kéo thả hoặc nhấn để chọn ảnh</p>
                    <small className="text-muted">PNG, JPG — tối đa 2MB</small>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrUpload}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VNPay */}
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-bottom">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <i className="feather-zap" style={{ color: '#f59e0b' }} />
                    <h5 className="mb-0" style={{ fontSize: 16 }}>VNPay (Tùy chọn)</h5>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="vnpayToggle"
                      checked={form.vnpayEnabled}
                      onChange={(e) => setField('vnpayEnabled', e.target.checked)}
                      style={{ width: 44, height: 22 }}
                    />
                    <label className="form-check-label ms-2" htmlFor="vnpayToggle" style={{ fontSize: 14, color: '#64748b' }}>
                      {form.vnpayEnabled ? 'Đang bật' : 'Đang tắt'}
                    </label>
                  </div>
                </div>
              </div>
              {form.vnpayEnabled && (
                <div className="card-body">
                  <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                    Bật VNPay để người chơi thanh toán trực tuyến qua cổng VNPay.
                    Liên hệ VNPay để lấy mã merchant.
                  </p>
                  <div className="row">
                    <div className="col-md-6">
                      <label className="form-label">Mã Merchant (VNPay)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nhập mã merchant ID"
                        value={form.vnpayMerchantId}
                        onChange={(e) => setField('vnpayMerchantId', e.target.value)}
                      />
                      <small className="text-muted">Liên hệ VNPay để được cấp mã</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="alert alert-info mt-4 d-flex align-items-start gap-2" style={{ fontSize: 13 }}>
          <i className="feather-info" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            Cài đặt thanh toán này áp dụng cho <strong>tất cả cụm sân</strong> của bạn.
            Người chơi sẽ thấy thông tin này khi thanh toán đặt sân.
          </div>
        </div>

        {/* Submit */}
        <div className="d-flex gap-3 mt-4">
          <button type="submit" className="btn btn-secondary d-inline-flex align-items-center">
            <i className="feather-save me-2" />Lưu cài đặt
          </button>
        </div>
      </form>
    </>
  );
}

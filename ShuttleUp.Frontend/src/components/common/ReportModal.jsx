import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../../api/axiosClient';
import { notifyError, notifySuccess } from '../../hooks/useNotification';

const TARGET_LABEL = {
  USER: 'người dùng',
  VENUE: 'cụm sân',
  MATCHING_POST: 'bài đăng',
  BOOKING: 'giao dịch',
};

const TARGET_ICON = {
  USER: 'feather-user',
  VENUE: 'feather-map-pin',
  MATCHING_POST: 'feather-file-text',
  BOOKING: 'feather-credit-card',
};

function reasonOptions(targetType) {
  switch (targetType) {
    case 'USER':
      return [
        { value: 'NO_SHOW', label: 'Bùng kèo / không đến' },
        { value: 'BAD_ATTITUDE', label: 'Thái độ không phù hợp' },
        { value: 'SPAM', label: 'Spam / quấy rối' },
        { value: 'SCAM', label: 'Có dấu hiệu lừa đảo' },
        { value: 'OTHER', label: 'Khác' },
      ];
    case 'VENUE':
      return [
        { value: 'NOT_AS_ADVERTISED', label: 'Cơ sở vật chất không đúng mô tả' },
        { value: 'EXTRA_FEE', label: 'Thu thêm phụ phí sai quy định' },
        { value: 'BAD_SERVICE', label: 'Thái độ phục vụ kém' },
        { value: 'DOUBLE_BOOKING', label: 'Trùng lịch / sắp xếp không hợp lý' },
        { value: 'OTHER', label: 'Khác' },
      ];
    case 'MATCHING_POST':
      return [
        { value: 'INAPPROPRIATE', label: 'Nội dung phản cảm' },
        { value: 'SPAM', label: 'Spam quảng cáo' },
        { value: 'SCAM', label: 'Có dấu hiệu lừa đảo' },
        { value: 'OTHER', label: 'Khác' },
      ];
    case 'BOOKING':
      return [
        { value: 'PAID_NOT_RECORDED', label: 'Đã thanh toán nhưng hệ thống chưa ghi nhận' },
        { value: 'WRONG_AMOUNT', label: 'Số tiền bị trừ sai' },
        { value: 'REFUND_ISSUE', label: 'Vấn đề hoàn tiền' },
        { value: 'OTHER', label: 'Khác' },
      ];
    default:
      return [{ value: 'OTHER', label: 'Khác' }];
  }
}

export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  title = 'Gửi report',
  requireImage = false,
}) {
  const mountedRef = useRef(false);
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState([]); // { id, url }
  const [errors, setErrors] = useState({});
  const [previewImg, setPreviewImg] = useState(null);

  const options = useMemo(() => reasonOptions(targetType), [targetType]);

  useEffect(() => {
    if (!open) return;
    mountedRef.current = true;
    setSubmitting(false);
    setReason('');
    setDesc('');
    setFiles([]);
    setErrors({});
    setPreviewImg(null);
    return () => { mountedRef.current = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (previewImg) setPreviewImg(null);
        else onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, previewImg]);

  if (!open) return null;

  const validate = () => {
    const next = {};
    if (!targetType || !targetId) next.form = 'Thiếu đối tượng cần report.';
    if (!reason) next.reason = 'Vui lòng chọn lý do khiếu nại.';
    if ((desc || '').trim().length > 3000) next.desc = 'Mô tả tối đa 3000 ký tự.';
    if (requireImage && files.length === 0) next.files = 'Khiếu nại giao dịch cần ít nhất 1 ảnh minh chứng.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const uploadOne = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await axiosClient.post(`/reports/${targetId}/upload-image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { id: res.fileId, url: res.url };
  };

  const onPickFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (list.length === 0) return;
    try {
      setSubmitting(true);
      const uploaded = [];
      for (const f of list.slice(0, 6)) {
        // eslint-disable-next-line no-await-in-loop
        uploaded.push(await uploadOne(f));
      }
      if (!mountedRef.current) return;
      setFiles((prev) => [...prev, ...uploaded].slice(0, 6));
      setErrors((prev) => ({ ...prev, files: undefined }));
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Tải ảnh thất bại.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const body = {
        targetType,
        targetId,
        reason,
        description: (desc || '').trim() || null,
        fileIds: files.map((x) => x.id),
      };
      const res = await axiosClient.post('/reports', body);
      notifySuccess(res?.message || 'Đã gửi report thành công!');
      onClose?.();
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Gửi report thất bại.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const iconClass = TARGET_ICON[targetType] || 'feather-flag';

  return createPortal(
    <>
      {/* Main Modal */}
      <div className="bk-modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div
          className="bk-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 600, width: '95%' }}
        >
          {/* Header */}
          <div className="bk-modal-header" style={{ background: '#fefce8', borderBottom: '1px solid #fde68a' }}>
            <div className="d-flex align-items-center gap-3">
              <div
                className="bk-modal-icon"
                style={{ background: '#fef3c7', borderColor: '#fbbf24', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fbbf24' }}
              >
                <i className="feather-flag" style={{ color: '#d97706', fontSize: 20 }} />
              </div>
              <div>
                <h5 className="bk-modal-title mb-0" style={{ color: '#92400e', fontSize: 16 }}>{title}</h5>
                <p className="bk-modal-sub mb-0" style={{ fontSize: 12, color: '#a16207' }}>
                  <i className={iconClass} style={{ fontSize: 11, marginRight: 4 }} />
                  Báo cáo {TARGET_LABEL[targetType] || 'đối tượng'} — chúng tôi sẽ xem xét và phản hồi sớm
                </p>
              </div>
            </div>
            <button type="button" className="bk-modal-close" onClick={onClose}>
              <i className="feather-x" />
            </button>
          </div>

          {/* Body */}
          <div className="bk-modal-body" style={{ padding: '20px 24px' }}>
            {errors.form && (
              <div className="mb-3 p-3 rounded" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                <small className="text-danger fw-semibold"><i className="feather-alert-circle me-1" />{errors.form}</small>
              </div>
            )}

            {/* Reason */}
            <div className="mb-3">
              <label className="d-flex align-items-center gap-1 mb-2" style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                <i className="feather-help-circle" style={{ fontSize: 14, color: '#d97706' }} />
                Lý do khiếu nại <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setErrors(p => ({ ...p, reason: undefined })); }}
                style={{
                  borderRadius: 10,
                  border: errors.reason ? '2px solid #f87171' : '1.5px solid #e2e8f0',
                  padding: '10px 14px',
                  fontSize: 14,
                  transition: 'border-color .2s',
                }}
              >
                <option value="">— Chọn lý do —</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.reason && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: 600 }}><i className="feather-alert-triangle me-1" style={{ fontSize: 11 }} />{errors.reason}</div>}
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="d-flex align-items-center gap-1 mb-2" style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                <i className="feather-message-square" style={{ fontSize: 14, color: '#64748b' }} />
                Mô tả thêm <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>(không bắt buộc)</span>
              </label>
              <textarea
                className="form-control"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Mô tả chi tiết vấn đề bạn gặp phải…"
                style={{
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  padding: '10px 14px',
                  fontSize: 14,
                  resize: 'vertical',
                  transition: 'border-color .2s',
                }}
              />
              {errors.desc && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{errors.desc}</div>}
            </div>

            {/* File Upload */}
            <div className="mb-2">
              <label className="d-flex align-items-center gap-1 mb-2" style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                <i className="feather-image" style={{ fontSize: 14, color: '#3b82f6' }} />
                Ảnh minh chứng {requireImage ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>(không bắt buộc)</span>}
              </label>

              {/* Upload zone */}
              <div
                onClick={() => { if (files.length < 6 && !submitting) fileInputRef.current?.click(); }}
                style={{
                  border: errors.files ? '2px dashed #f87171' : '2px dashed #cbd5e1',
                  borderRadius: 12,
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: files.length >= 6 || submitting ? 'not-allowed' : 'pointer',
                  background: files.length >= 6 ? '#f8fafc' : '#fafbfc',
                  transition: 'border-color .2s, background .2s',
                }}
              >
                <i className="feather-upload-cloud" style={{ fontSize: 28, color: files.length >= 6 ? '#cbd5e1' : '#3b82f6', marginBottom: 6, display: 'block' }} />
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                  {submitting ? 'Đang tải ảnh lên…' : files.length >= 6 ? 'Đã đạt tối đa 6 ảnh' : 'Nhấn để chọn ảnh hoặc kéo thả vào đây'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Tối đa 6 ảnh • Mỗi ảnh ≤ 5MB • JPG, PNG
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPickFiles}
                disabled={submitting || files.length >= 6}
                style={{ display: 'none' }}
              />
              {errors.files && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: 600 }}><i className="feather-alert-triangle me-1" style={{ fontSize: 11 }} />{errors.files}</div>}

              {/* Image preview grid */}
              {files.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginTop: 12 }}>
                  {files.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        position: 'relative',
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: '2px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'border-color .2s',
                      }}
                      onClick={() => setPreviewImg(f.url)}
                    >
                      <img src={f.url} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                      {/* Hover overlay */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(transparent 40%, rgba(0,0,0,.45))',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 6,
                      }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}><i className="feather-maximize-2 me-1" style={{ fontSize: 9 }} />Xem</span>
                      </div>
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((x) => x.id !== f.id)); }}
                        title="Gỡ ảnh"
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          border: 'none', background: 'rgba(239,68,68,.85)', color: '#fff',
                          width: 22, height: 22, borderRadius: 6,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, lineHeight: 1, fontWeight: 700,
                          transition: 'background .2s',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 20px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', background: '#fff',
                color: '#475569', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', transition: 'all .2s',
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                padding: '9px 24px', borderRadius: 10,
                border: 'none',
                background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(217,119,6,.3)',
                transition: 'all .2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {submitting ? (
                <><span className="spinner-border spinner-border-sm" /> Đang gửi…</>
              ) : (
                <><i className="feather-send" style={{ fontSize: 14 }} /> Gửi khiếu nại</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview Overlay */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.85)', zIndex: 1300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewImg(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,.9)', border: 'none',
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: '#0f172a',
              boxShadow: '0 2px 10px rgba(0,0,0,.3)',
            }}
          >
            <i className="feather-x" />
          </button>
          <img
            src={previewImg}
            alt="Ảnh minh chứng"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90%', maxHeight: '85vh',
              objectFit: 'contain', borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,.5)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </>,
    document.body,
  );
}

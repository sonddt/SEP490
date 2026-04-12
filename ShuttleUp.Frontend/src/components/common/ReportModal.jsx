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
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState([]); // { id, url }
  const [errors, setErrors] = useState({});

  const options = useMemo(() => reasonOptions(targetType), [targetType]);

  useEffect(() => {
    if (!open) return;
    mountedRef.current = true;
    setSubmitting(false);
    setReason('');
    setDesc('');
    setFiles([]);
    setErrors({});
    return () => { mountedRef.current = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const validate = () => {
    const next = {};
    if (!targetType || !targetId) next.form = 'Oops… Thiếu đối tượng cần report.';
    if (!reason) next.reason = 'Oops… Bạn chọn giúp mình 1 lý do nhé.';
    if ((desc || '').trim().length > 3000) next.desc = 'Oops… Mô tả tối đa 3000 ký tự.';
    if (requireImage && files.length === 0) next.files = 'Oops… Khiếu nại giao dịch cần ít nhất 1 ảnh minh chứng.';
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
      notifyError(err?.response?.data?.message || 'Oops… Tải ảnh thất bại.');
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
      notifySuccess(res?.message || 'Đã gửi report.');
      onClose?.();
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Oops… Gửi report thất bại.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.55)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 18px 60px rgba(0,0,0,.25)',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900, color: '#0f172a' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, color: '#64748b' }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          {errors.form && <div style={{ color: '#b45309', fontWeight: 700, marginBottom: 10 }}>{errors.form}</div>}

          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            Bạn đang report {TARGET_LABEL[targetType] || 'đối tượng'} này. Mình sẽ xem xét và phản hồi sớm.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Lý do</label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ marginTop: 6 }}
              >
                <option value="">— Chọn lý do —</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.reason && <div style={{ color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{errors.reason}</div>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Mô tả thêm <span style={{ color: '#64748b', fontWeight: 600 }}>(không bắt buộc)</span>
              </label>
              <textarea
                className="form-control"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                placeholder="Bạn mô tả ngắn gọn giúp mình nhé…"
                style={{ marginTop: 6, resize: 'vertical' }}
              />
              {errors.desc && <div style={{ color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{errors.desc}</div>}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Ảnh minh chứng {requireImage ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#64748b', fontWeight: 600 }}>(không bắt buộc)</span>}
              </label>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <input type="file" accept="image/*" multiple onChange={onPickFiles} disabled={submitting || files.length >= 6} />
                <div style={{ fontSize: 12, color: '#64748b' }}>Tối đa 6 ảnh, mỗi ảnh ≤ 5MB.</div>
              </div>
              {errors.files && <div style={{ color: '#b45309', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{errors.files}</div>}

              {files.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginTop: 10 }}>
                  {files.map((f) => (
                    <div key={f.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                      <img src={f.url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                        title="Gỡ ảnh"
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          border: 'none',
                          background: 'rgba(15,23,42,.72)',
                          color: '#fff',
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          cursor: 'pointer',
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>Đóng</button>
            <button type="button" className="btn btn-secondary" onClick={submit} disabled={submitting}>
              {submitting ? 'Đang gửi…' : 'Gửi report'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}


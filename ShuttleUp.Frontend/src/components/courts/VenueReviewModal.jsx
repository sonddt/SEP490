import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../../api/axiosClient';
import StarRatingInput from '../common/StarRatingInput';

/**
 * Modal đánh giá sân (tạo mới / sửa trong 3 ngày từ lúc tạo booking).
 */
const MAX_IMAGE_BYTES = 2_500_000;
const MAX_IMAGE_W = 4096;
const MAX_IMAGE_H = 4096;
const MIN_AR = 0.25;
const MAX_AR = 4;

function validateReviewImageFile(file) {
  if (!file?.type?.startsWith('image/')) return Promise.resolve('Chỉ chọn file ảnh.');
  if (file.size > MAX_IMAGE_BYTES) return Promise.resolve('Oops… Ảnh tối đa 2,5 MB.');
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > MAX_IMAGE_W || h > MAX_IMAGE_H) {
        resolve(`Oops… Kích thước tối đa ${MAX_IMAGE_W}×${MAX_IMAGE_H} px.`);
        return;
      }
      const ar = w / h;
      if (ar < MIN_AR || ar > MAX_AR) {
        resolve('Oops… Tỉ lệ ảnh nên từ 1:4 đến 4:1.');
        return;
      }
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('Không đọc được ảnh.');
    };
    img.src = url;
  });
}

function BookingDetailTooltip({ row }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowRight: 16 });
  const anchorRef = useRef(null);

  const handleEnter = () => {
    if (!anchorRef.current) { setShow(true); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    const tipW = 280;
    let left = rect.right - tipW;
    if (left < 8) left = 8;
    const arrowRight = Math.max(8, Math.min(tipW - 20, rect.right - left - rect.width / 2));
    setPos({ top: rect.bottom + 10, left, arrowRight });
    setShow(true);
  };

  if (!row) return null;

  const code = row.bookingCode ?? row.BookingCode ?? '';
  const court = row.courtLabel ?? row.CourtLabel ?? '';
  const venue = row.venueName ?? row.VenueName ?? '';
  const courtDisplay = court || venue || 'Sân';
  const date = row.dateLabel ?? row.DateLabel ?? '';
  const time = row.timeLabel ?? row.TimeLabel ?? '';
  const amount = Number(row.finalAmount ?? row.FinalAmount ?? 0);

  return (
    <span
      ref={anchorRef}
      style={{ display: 'inline-block' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      <span
        role="button"
        style={{
          color: '#2563eb',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          userSelect: 'none',
        }}
      >
        Chi tiết
      </span>
      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 280,
            background: '#1e293b',
            color: '#f1f5f9',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            lineHeight: 1.7,
            boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            top: -6,
            right: pos.arrowRight,
            width: 12,
            height: 12,
            background: '#1e293b',
            transform: 'rotate(45deg)',
          }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ color: '#94a3b8', paddingRight: 12, verticalAlign: 'top' }}>Sân</td><td style={{ fontWeight: 600 }}>{courtDisplay}</td></tr>
              <tr><td style={{ color: '#94a3b8', paddingRight: 12 }}>Mã đặt</td><td style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{code || '—'}</td></tr>
              <tr><td style={{ color: '#94a3b8', paddingRight: 12 }}>Ngày</td><td>{date || '—'}</td></tr>
              <tr><td style={{ color: '#94a3b8', paddingRight: 12 }}>Giờ</td><td>{time || '—'}</td></tr>
              <tr><td style={{ color: '#94a3b8', paddingRight: 12 }}>Thanh toán</td><td style={{ fontWeight: 600 }}>{amount.toLocaleString('vi-VN')} ₫</td></tr>
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </span>
  );
}

export default function VenueReviewModal({ venueId, open, onClose, onSaved, initialBookingId }) {
  const [eligible, setEligible] = useState([]);
  const [reviewsPayload, setReviewsPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [fileIds, setFileIds] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    if (!venueId || !open) return;
    setLoading(true);
    setError('');
    try {
      const [elRes, revRes] = await Promise.all([
        axiosClient.get(`/venues/${venueId}/reviews/eligible-bookings`),
        axiosClient.get(`/venues/${venueId}/reviews`),
      ]);
      const el = elRes.data ?? elRes;
      const rev = revRes.data ?? revRes;
      setEligible(Array.isArray(el) ? el : []);
      setReviewsPayload(rev);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Không tải được dữ liệu.');
      setEligible([]);
    } finally {
      setLoading(false);
    }
  }, [venueId, open]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  useEffect(() => {
    if (!open) return;
    const rows = eligible.filter((r) => r.canSubmitNew || r.canEditExisting);
    if (rows.length === 0) return;
    const preferred =
      initialBookingId &&
      rows.find(
        (r) =>
          String(r.bookingId ?? r.BookingId).toLowerCase() === String(initialBookingId).toLowerCase(),
      );
    const first = preferred || rows[0];
    const bid = first.bookingId ?? first.BookingId;
    setBookingId(bid);
    setStars(0);
    setComment('');
    setFileIds([]);
    if (first.canEditExisting && first.existingReviewId && reviewsPayload?.reviews) {
      const rv = reviewsPayload.reviews.find(
        (x) => (x.id || x.Id) === first.existingReviewId
      );
      if (rv) {
        setStars(Number(rv.stars ?? rv.Stars ?? 0));
        setComment(rv.comment ?? rv.Comment ?? '');
        const fids = rv.fileIds ?? rv.FileIds ?? [];
        setFileIds(Array.isArray(fids) ? [...fids] : []);
      }
    }
  }, [open, eligible, reviewsPayload, initialBookingId]);

  const selectedRow = eligible.find((r) => r.bookingId === bookingId || r.BookingId === bookingId);

  const handleBookingChange = (e) => {
    const bid = e.target.value;
    setBookingId(bid);
    const row = eligible.find((r) => r.bookingId === bid || r.BookingId === bid);
    if (!row || !reviewsPayload?.reviews) return;
    if (row.canEditExisting && row.existingReviewId) {
      const rv = reviewsPayload.reviews.find(
        (x) => (x.id || x.Id) === row.existingReviewId
      );
      if (rv) {
        setStars(Number(rv.stars ?? rv.Stars ?? 0));
        setComment(rv.comment ?? rv.Comment ?? '');
        const fids = rv.fileIds ?? rv.FileIds ?? [];
        setFileIds(Array.isArray(fids) ? [...fids] : []);
        return;
      }
    }
    setStars(0);
    setComment('');
    setFileIds([]);
  };

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (fileIds.length + files.length > 5) {
      setError('Oops… Tối đa 5 ảnh.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const next = [...fileIds];
      for (const file of files) {
        if (next.length >= 5) break;
        const err = await validateReviewImageFile(file);
        if (err) {
          setError(err);
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        const res = await axiosClient.post(`/venues/${venueId}/reviews/upload-image`, fd);
        const data = res.data ?? res;
        const fid = data.fileId ?? data.FileId;
        if (fid) next.push(fid);
      }
      setFileIds(next);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Tải ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const removeFileAt = (idx) => {
    setFileIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const row = selectedRow;
    if (!row) {
      setError('Oops… Chọn đơn đặt sân.');
      return;
    }
    if (!stars || stars < 1) {
      setError('Oops… Hãy chọn số sao trước khi gửi.');
      return;
    }
    const bid = row.bookingId ?? row.BookingId;
    const isEdit = row.canEditExisting && row.existingReviewId;
    setSubmitting(true);
    try {
      if (isEdit) {
        const rid = row.existingReviewId;
        await axiosClient.put(`/venues/${venueId}/reviews/${rid}`, {
          stars,
          comment: comment.trim() || null,
          fileIds,
        });
      } else {
        const body = {
          bookingId: bid,
          stars,
          comment: comment.trim() || null,
        };
        if (fileIds.length) body.fileIds = fileIds;
        await axiosClient.post(`/venues/${venueId}/reviews`, body);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không gửi được đánh giá.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const rows = eligible.filter((r) => r.canSubmitNew || r.canEditExisting);
  const noOption = !loading && rows.length === 0;

  return createPortal(
    <div
      className="venue-review-modal-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-review-modal-title"
    >
      <div
        className="bg-white corner-radius-10 p-4"
        style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h4 id="venue-review-modal-title" className="mb-0" style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}>
            Viết đánh giá
          </h4>
          <button type="button" className="btn btn-link p-0" onClick={onClose} aria-label="Đóng">
            <i className="feather-x" />
          </button>
        </div>

        {loading ? (
          <p className="text-muted mb-0">Đang tải…</p>
        ) : noOption ? (
          <p className="text-muted mb-0">
            Bạn chưa có đơn đặt sân đã xác nhận tại đây trong vòng 3 ngày, hoặc đã hết thời hạn đánh giá.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {rows.length > 1 && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0">Chọn đơn đặt sân cần đánh giá</label>
                  <BookingDetailTooltip row={selectedRow} />
                </div>
                <select
                  className="form-select"
                  value={bookingId}
                  onChange={handleBookingChange}
                  required
                >
                  {rows.map((r) => {
                    const id = r.bookingId ?? r.BookingId;
                    const court = r.courtLabel ?? r.CourtLabel ?? '';
                    const venue = r.venueName ?? r.VenueName ?? '';
                    const nameDisplay = court || venue || 'Sân';
                    const date = r.dateLabel ?? r.DateLabel ?? '';
                    const time = r.timeLabel ?? r.TimeLabel ?? '';
                    const datePart = [date, time].filter(Boolean).join(' ');
                    const label = r.canEditExisting
                      ? `Sửa ĐG — ${nameDisplay}${datePart ? ` — ${datePart}` : ''}`
                      : `${nameDisplay}${datePart ? ` — ${datePart}` : ''}`;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <small className="text-muted">
                  Bạn có {rows.length} đơn đủ điều kiện đánh giá tại sân này.
                </small>
              </div>
            )}
            {rows.length === 1 && (() => {
              const sr = selectedRow;
              const court1 = sr?.courtLabel ?? sr?.CourtLabel ?? '';
              const venue1 = sr?.venueName ?? sr?.VenueName ?? '';
              const nameDisp = court1 || venue1 || 'Sân';
              const dateDisp = sr?.dateLabel ?? sr?.DateLabel ?? '';
              return (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                      Đánh giá cho: <strong>{nameDisp}</strong>
                      {dateDisp ? ` — ${dateDisp}` : ''}
                    </span>
                    <BookingDetailTooltip row={sr} />
                  </div>
                </div>
              );
            })()}

            <div className="mb-3">
              <label className="form-label d-block">Số sao</label>
              <StarRatingInput value={stars} onChange={setStars} size={32} />
              {stars > 0 && (
                <span className="ms-2 text-muted small">{stars} / 5</span>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Nhận xét</label>
              <textarea
                className="form-control"
                rows={4}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm… Gõ **in đậm** hoặc dán link https://…"
              />
              <small className="text-muted">Xuống dòng, **đậm**, link sẽ được hiển thị đẹp trên trang sân.</small>
            </div>

            <div className="mb-3">
              <label className="form-label">Ảnh (tối đa 5)</label>
              <input
                type="file"
                className="form-control"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || fileIds.length >= 5}
                onChange={onPickFiles}
              />
              <small className="text-muted d-block">
                JPEG/PNG/WebP, tối đa 2,5 MB, tối đa 4096×4096 px, tỉ lệ 1:4–4:1.
              </small>
              {uploading && <small className="text-muted">Đang tải ảnh…</small>}
              {fileIds.length > 0 && (
                <ul className="list-unstyled small mt-2 mb-0">
                  {fileIds.map((fid, idx) => (
                    <li key={fid} className="d-flex justify-content-between align-items-center gap-2">
                      <span className="text-truncate">{String(fid)}</span>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeFileAt(idx)}>
                        Xóa
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn btn-secondary" disabled={submitting || uploading || stars < 1}>
                {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

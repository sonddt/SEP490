import { useCallback, useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { notifyError, notifySuccess } from '../../hooks/useNotification';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'USER', label: 'Người dùng' },
  { value: 'VENUE', label: 'Cụm sân' },
  { value: 'MATCHING_POST', label: 'Bài ghép sân' },
  { value: 'BOOKING', label: 'Khiếu nại giao dịch' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'REVIEWING', label: 'Đang xem' },
  { value: 'REFUND_PENDING', label: 'Chờ hoàn tiền' },
  { value: 'REFUND_PENDING_OVERDUE', label: 'Chờ hoàn (quá hạn SLA)' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'REJECTED', label: 'Từ chối' },
];

const STATUS_BADGE = {
  PENDING: { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  REVIEWING: { label: 'Đang xem', cls: 'bg-info text-dark' },
  REFUND_PENDING: { label: 'Chờ hoàn tiền', cls: 'bg-primary' },
  RESOLVED: { label: 'Đã xử lý', cls: 'bg-success' },
  REJECTED: { label: 'Từ chối', cls: 'bg-secondary' },
};

const ACTION_OPTIONS = [
  { value: 'NO_ACTION', label: 'Không hành động' },
  { value: 'WARN_USER', label: 'Cảnh cáo người dùng' },
  { value: 'LOCK_USER', label: 'Khóa người dùng' },
  { value: 'WARN_VENUE', label: 'Cảnh cáo chủ sân' },
  { value: 'LOCK_VENUE', label: 'Khóa cụm sân' },
  { value: 'REMOVE_POST', label: 'Gỡ bài ghép sân' },
  { value: 'REFUND', label: 'Hoàn tiền (chủ sân thực hiện — không tự tạo refund)' },
];

export default function AdminReports() {
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1, page: 1, pageSize: 20 });
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (type && type !== 'ALL') params.append('targetType', type);
      if (status === 'REFUND_PENDING_OVERDUE') {
        params.append('status', 'REFUND_PENDING');
        params.append('overdueRefund', 'true');
      } else if (status && status !== 'ALL') {
        params.append('status', status);
      }
      if (search.trim()) params.append('search', search.trim());
      const res = await axiosClient.get(`/admin/reports?${params.toString()}`);
      setData(res);
    } catch (e) {
      setData({ items: [], totalItems: 0, totalPages: 1, page: 1, pageSize: 20 });
      notifyError(e?.response?.data?.message || 'Oops… Không tải được danh sách report.');
    } finally {
      setLoading(false);
    }
  }, [page, type, status, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, status, search]);

  const rows = data?.items || [];
  const totalPages = data?.totalPages ?? 1;

  const selectedBadge = useMemo(() => STATUS_BADGE[selected?.status] || null, [selected?.status]);

  const updateSelected = async (patch) => {
    if (!selected?.id) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.patch(`/admin/reports/${selected.id}`, patch);
      notifySuccess(res?.message || 'Đã cập nhật report.');
      if (res?.report) {
        setSelected((s) => (s ? { ...s, ...res.report } : s));
      } else {
        setSelected((s) => (s ? { ...s, ...patch } : s));
      }
      await load();
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Oops… Cập nhật thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="card card-tableset">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h4 className="mb-1">Báo cáo &amp; Khiếu nại</h4>
              <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Quản lý report người dùng, sân, bài ghép sân và tranh chấp giao dịch</p>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <select className="form-select" style={{ width: 210 }} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="form-select" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <i className="feather-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
              <input
                className="form-control"
                style={{ paddingLeft: 32 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo người báo cáo, lý do, mô tả…"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8' }}
                >
                  <i className="feather-x" />
                </button>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th>Loại</th>
                  <th>Người báo cáo</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Hạn / SLA</th>
                  <th>Thời gian</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7}>
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: 28 }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">Không có report.</td>
                  </tr>
                ) : rows.map((r) => {
                  const b = STATUS_BADGE[r.status] || { label: r.status, cls: 'bg-secondary' };
                  const overdue = Boolean(r.refundOverdue);
                  return (
                    <tr key={r.id}>
                      <td><span className="badge bg-light text-dark">{r.targetType}</span></td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.reporter?.fullName || '—'}</div>
                        <div className="text-muted small">{r.reporter?.email || ''}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{r.reason}</div>
                        {r.description && <div className="text-muted small" style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>}
                      </td>
                      <td>
                        <span className={`badge ${b.cls}`}>{b.label}</span>
                        {overdue && (
                          <span className="badge bg-danger ms-1">Quá hạn</span>
                        )}
                      </td>
                      <td className="text-muted small" style={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'REFUND_PENDING' && r.refundDeadlineAt
                          ? new Date(r.refundDeadlineAt).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td className="text-muted small" style={{ whiteSpace: 'nowrap' }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(r)}>
                          <i className="feather-eye me-1" />Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>Trang {page} / {totalPages}</span>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <i className="feather-chevron-left" /> Trước
                </button>
                <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  Sau <i className="feather-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">Chi tiết report</h5>
                  <div className="text-muted small">
                    {selected.targetType} · {selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}
                    {selectedBadge && <span className={`badge ms-2 ${selectedBadge.cls}`}>{selectedBadge.label}</span>}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelected(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="text-muted small">Người báo cáo</div>
                    <div style={{ fontWeight: 900 }}>{selected.reporter?.fullName || '—'}</div>
                    <div className="text-muted small">{selected.reporter?.email || ''}</div>
                  </div>
                  <div className="col-md-6">
                    <div className="text-muted small">Lý do</div>
                    <div style={{ fontWeight: 900 }}>{selected.reason}</div>
                  </div>
                  {selected.description && (
                    <div className="col-12">
                      <div className="text-muted small">Mô tả</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{selected.description}</div>
                    </div>
                  )}
                  {selected.fileUrls?.length > 0 && (
                    <div className="col-12">
                      <div className="text-muted small mb-2">Ảnh minh chứng</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                        {selected.fileUrls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                            <img src={u} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.targetType === 'BOOKING' && selected.status === 'REFUND_PENDING' && selected.refundDeadlineAt && (
                    <div className="col-12">
                      <div className="alert alert-info mb-0 py-2" style={{ fontSize: '0.9rem' }}>
                        <strong>Hạn xử lý hoàn tiền (gợi ý):</strong>{' '}
                        {new Date(selected.refundDeadlineAt).toLocaleString('vi-VN')}
                        {selected.refundOverdue && (
                          <span className="text-danger fw-bold ms-2">Đã quá hạn SLA — ưu tiên xử lý.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.targetType === 'BOOKING' && (
                    <div className="col-12">
                      <p className="text-muted small mb-0">
                        Luồng khiếu nại: chọn <strong>Chờ hoàn tiền</strong> + <strong>Hoàn tiền (chủ sân…)</strong> để hệ thống gửi thông báo cho người chơi và chủ sân (không tạo refund tự động).
                        Sau khi đã hoàn xong, chuyển <strong>Đã xử lý</strong> (có thể giữ hoặc đổi hành động).
                      </p>
                    </div>
                  )}

                  <div className="col-12">
                    <div className="text-muted small mb-2">Xử lý</div>
                    <div className="d-flex flex-wrap gap-2">
                      <select
                        className="form-select"
                        style={{ width: 220 }}
                        value={selected.status || 'PENDING'}
                        onChange={(e) => setSelected((s) => ({ ...s, status: e.target.value }))}
                        disabled={actionLoading}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value !== 'ALL' && o.value !== 'REFUND_PENDING_OVERDUE').map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        style={{ width: 240 }}
                        value={selected.adminAction || 'NO_ACTION'}
                        onChange={(e) => setSelected((s) => ({ ...s, adminAction: e.target.value }))}
                        disabled={actionLoading}
                      >
                        {ACTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="form-control mt-2"
                      rows={3}
                      placeholder="Ghi chú xử lý (không bắt buộc)…"
                      value={selected.adminNote || ''}
                      onChange={(e) => setSelected((s) => ({ ...s, adminNote: e.target.value }))}
                      disabled={actionLoading}
                    />
                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setSelected(null)} disabled={actionLoading}>Đóng</button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => updateSelected({ status: selected.status || 'PENDING', adminAction: selected.adminAction || 'NO_ACTION', adminNote: selected.adminNote || '' })}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Đang lưu…' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


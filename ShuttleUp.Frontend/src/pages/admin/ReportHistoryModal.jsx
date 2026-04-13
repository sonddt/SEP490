import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';

const STATUS_LABELS = {
  PENDING: { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  REVIEWING: { label: 'Đang xem', cls: 'bg-info text-dark' },
  REFUND_PENDING: { label: 'Chờ hoàn tiền', cls: 'bg-primary' },
  RESOLVED: { label: 'Đã xử lý', cls: 'bg-success' },
  REJECTED: { label: 'Từ chối', cls: 'bg-secondary' },
};

const ACTION_LABELS = {
  NO_ACTION: 'Không hành động',
  WARN_USER: 'Cảnh báo',
  LOCK_USER: 'Khóa tài khoản',
  REMOVE_POST: 'Gỡ bài ghép sân',
  REFUND: 'Hoàn tiền (thủ công)',
};

export default function ReportHistoryModal({ reportId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!reportId) return;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/admin/reports/${reportId}/history`);
        setLogs(res);
      } catch (err) {
        console.error('Failed to fetch report history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [reportId]);

  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1300 }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 16 }}>
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title fw-bold">Lịch xử xử lý báo cáo</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body py-4">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <div className="mt-2 text-muted small">Đang tải lịch sử…</div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="feather-clock mb-2 d-block" style={{ fontSize: 32 }} />
                Chưa có lịch sử thao tác cho report này.
              </div>
            ) : (
              <div className="timeline">
                {logs.map((log, idx) => {
                  const s = STATUS_LABELS[log.status] || { label: log.status, cls: 'bg-secondary' };
                  return (
                    <div key={log.id} className="d-flex mb-4 position-relative">
                      {idx !== logs.length - 1 && (
                        <div style={{ position: 'absolute', left: 15, top: 30, bottom: -20, borderLeft: '2px dashed #e2e8f0' }} />
                      )}
                      <div
                        className="flex-shrink-0 bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 32, height: 32, zIndex: 1 }}
                      >
                        <i className="feather-check-circle" style={{ fontSize: 14 }} />
                      </div>
                      <div className="ms-3 flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
                          <div>
                            <span className={`badge ${s.cls} me-2`}>{s.label}</span>
                            <span className="text-muted small">bởi <strong>{log.adminName}</strong></span>
                          </div>
                          <div className="text-muted small">{new Date(log.createdAt).toLocaleString('vi-VN')}</div>
                        </div>
                        <div className="small mb-1">
                          <strong>Hành động:</strong> {ACTION_LABELS[log.adminAction] || log.adminAction || 'Không hành động'}
                        </div>
                        {log.adminNote && (
                          <div className="p-2 bg-light rounded small text-muted italic">
                            &quot;{log.adminNote}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-footer border-top-0 pt-0">
            <button type="button" className="btn btn-outline-secondary px-4" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </div>
  );
}

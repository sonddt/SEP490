import { useCallback, useEffect, useState } from 'react';
import socialApi from '../../api/socialApi';
import { showBkToast } from '../../utils/bkToast';

/**
 * Nút thao tác quan hệ (kết bạn / chặn / v.v.) — dùng chung trên tìm kiếm và profile người khác.
 */
export default function RelationshipActions({
  otherUserId,
  initialState = null,
  initialRequestId = null,
  onChanged,
}) {
  const [state, setState] = useState(initialState);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [loading, setLoading] = useState(initialState == null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await socialApi.getRelationship(otherUserId);
      setState(data.state);
      setRequestId(data.requestId ?? null);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    if (initialState != null) {
      setState(initialState);
      setRequestId(initialRequestId);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    refresh();
    return undefined;
  }, [otherUserId, initialState, initialRequestId, refresh]);

  useEffect(() => {
    if (initialState != null) {
      setState(initialState);
      setRequestId(initialRequestId);
    }
  }, [initialState, initialRequestId]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const result = await fn();
      const serverMsg = result && typeof result === 'object' && typeof result.message === 'string' ? result.message : '';
      const toastText = serverMsg || okMsg;
      if (toastText) showBkToast(toastText, 'success');
      await refresh();
      onChanged?.();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        (typeof e?.response?.data === 'string' ? e.response.data : null) ||
        'Không thực hiện được thao tác này lúc này.';
      showBkToast(msg, 'warning');
    } finally {
      setBusy(false);
    }
  };

  const btn = (label, onClick, variant = 'primary', key) => (
    <button
      key={key || label}
      type="button"
      className={`btn btn-sm btn-${variant} me-1 mb-1`}
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </button>
  );

  if (loading) {
    return <span className="text-muted small">Đang tải…</span>;
  }
  if (!state || state === 'SELF') {
    return null;
  }

  switch (state) {
    case 'NONE':
      return (
        <div className="d-flex flex-wrap align-items-center">
          {btn('Kết bạn', () => run(() => socialApi.sendFriendRequest(otherUserId), 'Đã gửi lời mời.'))}
          {btn('Chặn', () => run(() => socialApi.block(otherUserId), 'Đã cập nhật.'), 'outline-secondary', 'block')}
        </div>
      );
    case 'PENDING_OUT':
      return (
        <div>
          {btn(
            'Thu hồi lời mời',
            () => run(() => socialApi.cancelSentRequest(otherUserId), 'Đã thu hồi lời mời.'),
            'outline-primary'
          )}
        </div>
      );
    case 'PENDING_IN':
      return (
        <div className="d-flex flex-wrap">
          {btn('Chấp nhận', () => run(() => socialApi.acceptRequest(requestId), 'Tuyệt — hai bạn đã là bạn bè.'))}
          {btn(
            'Từ chối',
            () => run(() => socialApi.declineRequest(requestId), 'Đã cập nhật.'),
            'outline-secondary',
            'decline'
          )}
        </div>
      );
    case 'FRIENDS':
      return (
        <div className="d-flex flex-wrap">
          {btn(
            'Huỷ kết bạn',
            () => run(() => socialApi.unfriend(otherUserId), 'Đã cập nhật danh sách bạn bè.'),
            'outline-danger',
            'unfriend'
          )}
          {btn('Chặn', () => run(() => socialApi.block(otherUserId), 'Đã cập nhật.'), 'outline-secondary', 'block2')}
        </div>
      );
    case 'BLOCKED_BY_ME':
      return <div>{btn('Bỏ chặn', () => run(() => socialApi.unblock(otherUserId), 'Đã bỏ chặn.'))}</div>;
    case 'BLOCKED_BY_THEM':
      return (
        <p className="text-muted small mb-0">
          Bạn chưa thể tương tác với người này trong lúc này.
        </p>
      );
    default:
      return null;
  }
}

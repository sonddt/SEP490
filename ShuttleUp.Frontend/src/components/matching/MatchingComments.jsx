import { useState, useEffect, useCallback, useRef } from 'react';
import matchingApi from '../../api/matchingApi';
import { useAuth } from '../../context/AuthContext';

const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';
const COMMENT_COOLDOWN_MS = 500;
/** Số bình luận hiển thị trước khi bấm "Xem thêm". */
const PREVIEW_COMMENT_LIMIT = 5;

/** Chuỗi ISO không có offset từ MySQL/BE cũ → coi là UTC để không lệch ~7h sau reload. */
function parseCommentDate(d) {
  if (d == null) return new Date(NaN);
  if (d instanceof Date) return d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(`${s}Z`);
  }
  return new Date(s);
}

function stripMessage(row) {
  if (!row || typeof row !== 'object') return row;
  const { message: _m, ...rest } = row;
  return rest;
}

function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export default function MatchingComments({ postId, isHost = false }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const lastCommentSentAt = useRef(0);

  const loadPreview = useCallback(async () => {
    try {
      const res = await matchingApi.getComments(postId, { page: 1, pageSize: PREVIEW_COMMENT_LIMIT });
      setComments(res.items);
      setTotal(res.total);
      setExpanded(false);
    } catch (err) {
      console.error('Load comments error', err);
    }
  }, [postId]);

  const loadAllComments = useCallback(async () => {
    try {
      const res = await matchingApi.getComments(postId, {
        page: 1,
        pageSize: Math.max(total, PREVIEW_COMMENT_LIMIT),
      });
      setComments(res.items);
      setTotal(res.total);
      setExpanded(true);
    } catch (err) {
      console.error('Load all comments error', err);
    }
  }, [postId, total]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    const now = Date.now();
    if (now - lastCommentSentAt.current < COMMENT_COOLDOWN_MS) {
      setFormError('Vui lòng không gửi quá nhanh.');
      return;
    }
    setFormError('');
    setSending(true);
    try {
      const res = await matchingApi.postComment(postId, { content: content.trim() });
      lastCommentSentAt.current = Date.now();
      setComments((prev) => [stripMessage(res), ...prev]);
      setTotal((t) => t + 1);
      setContent('');
    } catch (err) {
      console.error('Post comment error', err);
      const msg = err.response?.data?.message;
      if (err.response?.status === 429 && msg) setFormError(msg);
      else if (msg) setFormError(msg);
      else setFormError('Oops, chưa gửi được bình luận — bạn thử lại sau nhé.');
    } finally {
      setSending(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditText(c.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId || !editText.trim() || editBusy) return;
    setEditBusy(true);
    try {
      const res = await matchingApi.patchComment(postId, editingId, { content: editText.trim() });
      const row = stripMessage(res);
      setComments((prev) => prev.map((c) => (c.id === editingId ? row : c)));
      cancelEdit();
    } catch (err) {
      const msg = err.response?.data?.message;
      setFormError(msg || 'Chưa lưu được — bạn thử lại sau nhé.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleRemove = async (commentId) => {
    if (!window.confirm('Gỡ bình luận này khỏi cuộc trò chuyện?')) return;
    try {
      await matchingApi.deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((t) => Math.max(0, t - 1));
      if (editingId === commentId) cancelEdit();
    } catch (err) {
      const msg = err.response?.data?.message;
      setFormError(msg || 'Chưa gỡ được — bạn thử lại sau nhé.');
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = parseCommentDate(d);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatCommentTime = (c) => {
    const t = c.isEdited && c.updatedAt ? c.updatedAt : c.createdAt;
    return formatTime(t);
  };

  const displayComments = expanded ? comments : comments.slice(0, PREVIEW_COMMENT_LIMIT);
  const showXemThem = !expanded && total > PREVIEW_COMMENT_LIMIT;

  return (
    <div className="matching-comments">
      <h5 className="matching-comments-title">
        <i className="feather-message-circle"></i> Bình luận nhóm ({total})
      </h5>

      {/* ── Input ── */}
      <form className="matching-comment-form" onSubmit={handleSend}>
        <input
          type="text"
          className="form-control"
          placeholder="Viết bình luận..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (formError) setFormError('');
          }}
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!content.trim() || sending}>
          {sending ? '...' : 'Gửi'}
        </button>
      </form>
      {formError && <p className="text-warning small mb-2">{formError}</p>}

      {/* ── Comments list ── */}
      <div className="matching-comments-list">
        {displayComments.map((c) => {
          const isAuthor = sameUserId(c.userId, user?.id);
          const canEdit = isAuthor;
          const canDelete = isHost || isAuthor;

          return (
            <div key={c.id} className="matching-comment-item">
              <img
                src={c.avatarUrl || defaultAvatar}
                alt={c.fullName}
                className="matching-comment-avatar"
              />
              <div className="matching-comment-body">
                <div className="matching-comment-header">
                  <span className="matching-comment-name">{c.fullName}</span>
                  <span className="matching-comment-time-wrap">
                    {c.isEdited && <span className="matching-comment-edited">Đã sửa · </span>}
                    <span className="matching-comment-time">{formatCommentTime(c)}</span>
                  </span>
                </div>
                {editingId === c.id ? (
                  <form className="matching-comment-edit-form" onSubmit={handleSaveEdit}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="matching-comment-edit-actions">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!editText.trim() || editBusy}>
                        {editBusy ? '...' : 'Lưu'}
                      </button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelEdit} disabled={editBusy}>
                        Huỷ
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="matching-comment-content">{c.content}</p>
                    {(canEdit || canDelete) && (
                      <div className="matching-comment-actions">
                        {canEdit && (
                          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => startEdit(c)}>
                            Sửa
                          </button>
                        )}
                        {canEdit && canDelete && <span className="matching-comment-actions-sep">·</span>}
                        {canDelete && (
                          <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => handleRemove(c.id)}>
                            Gỡ
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {showXemThem && (
          <button type="button" className="btn btn-link btn-sm w-100" onClick={loadAllComments}>
            Xem thêm
          </button>
        )}

        {displayComments.length === 0 && total === 0 && (
          <p className="text-muted text-center py-3">Chưa có bình luận. Hãy là người đầu tiên! 🏸</p>
        )}
      </div>
    </div>
  );
}

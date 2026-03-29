import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import matchingApi from '../../api/matchingApi';
import { useAuth } from '../../context/AuthContext';
import CommentRichText from './CommentRichText';

const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';
const COMMENT_COOLDOWN_MS = 500;
const ROOT_PAGE_SIZE = 5;
const CONTENT_MAX = 2000;

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

function emptyThread() {
  return { expanded: false, loaded: false, loading: false, items: [] };
}

export default function MatchingComments({ postId, isHost = false, postMembers = [] }) {
  const { user } = useAuth();
  const mentionMembers = useMemo(
    () =>
      (postMembers || [])
        .map((m) => ({ userId: m.userId, fullName: m.fullName || '' }))
        .filter((m) => m.fullName),
    [postMembers]
  );

  const [roots, setRoots] = useState([]);
  const [totalRoots, setTotalRoots] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [rootsPage, setRootsPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [rootsLoading, setRootsLoading] = useState(false);

  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingHasAttachment, setEditingHasAttachment] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState(null);
  const [attachmentFileId, setAttachmentFileId] = useState(null);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [replyThreads, setReplyThreads] = useState({});

  const lastCommentSentAt = useRef(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const filteredMentions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return mentionMembers.slice(0, 8);
    return mentionMembers.filter((m) => m.fullName.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionMembers, mentionQuery]);

  const canSubmitNew = Boolean(
    content.trim() || pendingImageFile || attachmentFileId
  );

  const loadRoots = useCallback(
    async (page = 1, append = false) => {
      setRootsLoading(true);
      try {
        const res = await matchingApi.getComments(postId, {
          page,
          pageSize: ROOT_PAGE_SIZE,
          sort,
        });
        setTotalRoots(res.total);
        setTotalAll(res.totalAll ?? res.total);
        setRoots((prev) => (append ? [...prev, ...res.items] : res.items));
        if (!append) setReplyThreads({});
        setRootsPage(page);
      } catch (err) {
        console.error('Load comments error', err);
      } finally {
        setRootsLoading(false);
      }
    },
    [postId, sort]
  );

  useEffect(() => {
    loadRoots(1, false);
  }, [postId, sort, loadRoots]);

  const hasMoreRoots = roots.length < totalRoots;

  const loadRepliesForRoot = async (rootId) => {
    setReplyThreads((prev) => ({
      ...prev,
      [rootId]: { ...(prev[rootId] || emptyThread()), loading: true },
    }));
    try {
      const res = await matchingApi.getCommentReplies(postId, rootId, { page: 1, pageSize: 100 });
      setReplyThreads((prev) => ({
        ...prev,
        [rootId]: {
          expanded: true,
          loaded: true,
          loading: false,
          items: res.items || [],
        },
      }));
    } catch (err) {
      console.error('Load replies error', err);
      setReplyThreads((prev) => ({
        ...prev,
        [rootId]: { ...(prev[rootId] || emptyThread()), loading: false },
      }));
    }
  };

  const toggleReplies = (rootId, replyCount) => {
    if (replyCount <= 0) return;
    const cur = replyThreads[rootId] || emptyThread();
    if (cur.expanded) {
      setReplyThreads((prev) => ({
        ...prev,
        [rootId]: { ...cur, expanded: false },
      }));
      return;
    }
    if (!cur.loaded) {
      loadRepliesForRoot(rootId);
    } else {
      setReplyThreads((prev) => ({
        ...prev,
        [rootId]: { ...cur, expanded: true },
      }));
    }
  };

  const updateCommentEverywhere = (row) => {
    setRoots((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
    setReplyThreads((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const t = next[k];
        if (!t.items?.length) return;
        next[k] = { ...t, items: t.items.map((c) => (c.id === row.id ? { ...c, ...row } : c)) };
      });
      return next;
    });
  };

  const removeCommentEverywhere = (commentId, isRoot, parentRootId, replyCountOnRoot) => {
    if (isRoot) {
      setRoots((prev) => prev.filter((c) => c.id !== commentId));
      setTotalRoots((t) => Math.max(0, t - 1));
      setTotalAll((t) => Math.max(0, t - 1 - (replyCountOnRoot || 0)));
      setReplyThreads((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
    } else {
      setRoots((prev) =>
        prev.map((r) =>
          r.id === parentRootId ? { ...r, replyCount: Math.max(0, (r.replyCount || 0) - 1) } : r
        )
      );
      setTotalAll((t) => Math.max(0, t - 1));
      setReplyThreads((prev) => {
        const t = prev[parentRootId];
        if (!t?.items) return prev;
        return {
          ...prev,
          [parentRootId]: { ...t, items: t.items.filter((c) => c.id !== commentId) },
        };
      });
    }
  };

  const handleContentChange = (e) => {
    const v = e.target.value;
    setContent(v);
    if (formError) setFormError('');
    const pos = e.target.selectionStart;
    const before = v.slice(0, pos);
    const m = before.match(/@([^@\n]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
      setMentionHighlight(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (fullName) => {
    const el = textareaRef.current;
    if (!el) return;
    const v = content;
    const pos = el.selectionStart;
    const before = v.slice(0, pos);
    const after = v.slice(pos);
    const idx = before.lastIndexOf('@');
    if (idx < 0) return;
    const next = `${before.slice(0, idx)}@${fullName} ${after}`;
    setContent(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const caret = idx + fullName.length + 2;
      el.setSelectionRange(caret, caret);
    });
  };

  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) {
      setFormError('Chỉ chọn file ảnh nhé.');
      return;
    }
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(f);
    setPendingImagePreview(URL.createObjectURL(f));
    setAttachmentFileId(null);
    setFormError('');
  };

  const clearPendingImage = () => {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setAttachmentFileId(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!canSubmitNew || sending) return;
    const now = Date.now();
    if (now - lastCommentSentAt.current < COMMENT_COOLDOWN_MS) {
      setFormError('Vui lòng không gửi quá nhanh.');
      return;
    }
    setFormError('');
    setSending(true);
    let fileId = attachmentFileId;
    try {
      if (pendingImageFile && !fileId) {
        const up = await matchingApi.uploadCommentImage(postId, pendingImageFile);
        fileId = up.fileId;
      }
      const body = { content: content.trim() || '' };
      if (replyingTo?.id) body.parentCommentId = replyingTo.id;
      if (fileId) body.attachmentFileId = fileId;
      const res = await matchingApi.postComment(postId, body);
      lastCommentSentAt.current = Date.now();
      const row = stripMessage(res);
      if (!replyingTo?.id) {
        if (sort === 'newest') {
          setRoots((prev) => [row, ...prev]);
          setTotalRoots((t) => t + 1);
          setTotalAll((t) => t + 1);
        } else {
          await loadRoots(1, false);
        }
      } else {
        const rootId = replyingTo.id;
        setRoots((prev) =>
          prev.map((r) => (r.id === rootId ? { ...r, replyCount: (r.replyCount || 0) + 1 } : r))
        );
        setTotalAll((t) => t + 1);
        const th = replyThreads[rootId];
        if (th?.loaded && th.expanded) {
          setReplyThreads((prev) => ({
            ...prev,
            [rootId]: {
              ...prev[rootId],
              items: [...(prev[rootId].items || []), row],
            },
          }));
        }
      }
      setContent('');
      setReplyingTo(null);
      clearPendingImage();
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
    setEditingHasAttachment(Boolean(c.imageUrl || c.attachmentFileId));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditingHasAttachment(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId || (!editText.trim() && !editingHasAttachment) || editBusy) return;
    setEditBusy(true);
    try {
      const res = await matchingApi.patchComment(postId, editingId, { content: editText.trim() || '' });
      const row = stripMessage(res);
      updateCommentEverywhere(row);
      cancelEdit();
    } catch (err) {
      const msg = err.response?.data?.message;
      setFormError(msg || 'Chưa lưu được — bạn thử lại sau nhé.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleRemove = async (c, isRoot) => {
    if (!window.confirm('Gỡ bình luận này khỏi cuộc trò chuyện?')) return;
    try {
      await matchingApi.deleteComment(postId, c.id);
      const parentRootId = c.parentCommentId || c.id;
      removeCommentEverywhere(c.id, isRoot, parentRootId, isRoot ? c.replyCount || 0 : 0);
      if (editingId === c.id) cancelEdit();
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

  const renderCommentRow = (c, { isReply, rootId }) => {
    const isAuthor = sameUserId(c.userId, user?.id);
    const canEdit = isAuthor;
    const canDelete = isHost || isAuthor;
    const canReplyToThis = !isReply;

    return (
      <div key={c.id} className={`matching-comment-item${isReply ? ' matching-comment-item--reply' : ''}`}>
        <img src={c.avatarUrl || defaultAvatar} alt={c.fullName} className="matching-comment-avatar" />
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
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={CONTENT_MAX}
              />
              <div className="matching-comment-edit-actions">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={(!editText.trim() && !editingHasAttachment) || editBusy}
                >
                  {editBusy ? '...' : 'Lưu'}
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelEdit} disabled={editBusy}>
                  Huỷ
                </button>
              </div>
            </form>
          ) : (
            <>
              {isReply && (
                <p className="matching-comment-reply-to">
                  {c.replyToFullName ? (
                    <>
                      Trả lời <span className="matching-comment-reply-to-name">{c.replyToFullName}</span>
                    </>
                  ) : (
                    <span className="text-muted">Bình luận gốc đã được gỡ</span>
                  )}
                </p>
              )}
              {(c.content || '').trim() ? (
                <CommentRichText text={c.content} members={mentionMembers} />
              ) : null}
              {c.imageUrl && (
                <a href={c.imageUrl} target="_blank" rel="noopener noreferrer" className="matching-comment-image-link">
                  <img src={c.imageUrl} alt="" className="matching-comment-image" />
                </a>
              )}
              {(canReplyToThis || canEdit || canDelete) && (
                <div className="matching-comment-actions">
                  {canReplyToThis && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0"
                      onClick={() => {
                        setReplyingTo({ id: c.id, fullName: c.fullName });
                        setFormError('');
                      }}
                    >
                      Trả lời
                    </button>
                  )}
                  {canReplyToThis && (canEdit || canDelete) && <span className="matching-comment-actions-sep">·</span>}
                  {canEdit && (
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => startEdit(c)}>
                      Sửa
                    </button>
                  )}
                  {canEdit && canDelete && <span className="matching-comment-actions-sep">·</span>}
                  {canDelete && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-danger"
                      onClick={() => handleRemove(c, !isReply)}
                    >
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
  };

  return (
    <div className="matching-comments">
      <div className="matching-comments-title-row">
        <h5 className="matching-comments-title">
          <i className="feather-message-circle"></i> Bình luận nhóm ({totalAll})
        </h5>
        <select
          className="form-select form-select-sm matching-comments-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sắp xếp bình luận"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="popular">Phổ biến (nhiều phản hồi)</option>
        </select>
      </div>

      {replyingTo && (
        <div className="matching-comment-replying-banner">
          <span>
            Đang trả lời <strong>{replyingTo.fullName}</strong>
          </span>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setReplyingTo(null)}>
            Huỷ
          </button>
        </div>
      )}

      <form className="matching-comment-form matching-comment-form--stack" onSubmit={handleSend}>
        <div className="matching-comment-input-wrap">
          <textarea
            ref={textareaRef}
            className="form-control"
            placeholder={
              replyingTo
                ? `Trả lời ${replyingTo.fullName}... (có thể chỉ gửi ảnh)`
                : 'Viết bình luận... (@ để nhắc tên) — có thể chỉ đính kèm ảnh'
            }
            value={content}
            onChange={handleContentChange}
            onKeyDown={(e) => {
              if (!mentionOpen || !filteredMentions.length) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionHighlight((i) => Math.min(i + 1, filteredMentions.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionHighlight((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                insertMention(filteredMentions[mentionHighlight].fullName);
              } else if (e.key === 'Escape') {
                setMentionOpen(false);
              }
            }}
            maxLength={CONTENT_MAX}
            rows={3}
          />
          {mentionOpen && filteredMentions.length > 0 && (
            <ul className="matching-mention-dropdown list-unstyled mb-0">
              {filteredMentions.map((m, i) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    className={`dropdown-item ${i === mentionHighlight ? 'active' : ''}`}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      insertMention(m.fullName);
                    }}
                  >
                    {m.fullName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="matching-comment-form-actions">
          <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={onPickImage} />
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm 1 ảnh"
          >
            Ảnh
          </button>
          {pendingImagePreview && (
            <span className="matching-comment-pending-thumb-wrap">
              <img src={pendingImagePreview} alt="" className="matching-comment-pending-thumb" />
              <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={clearPendingImage}>
                Bỏ ảnh
              </button>
            </span>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canSubmitNew || sending}>
            {sending ? '...' : 'Gửi'}
          </button>
        </div>
      </form>
      <p className="text-muted small mb-2">{content.length}/{CONTENT_MAX} ký tự</p>
      {formError && <p className="text-warning small mb-2">{formError}</p>}

      <div className="matching-comments-list">
        {roots.map((root) => {
          const th = replyThreads[root.id] || emptyThread();
          const rc = root.replyCount || 0;
          return (
            <div key={root.id} className="matching-comment-thread">
              {renderCommentRow(root, { isReply: false, rootId: root.id })}
              {rc > 0 && (
                <button
                  type="button"
                  className="btn btn-link btn-sm matching-comment-replies-toggle"
                  onClick={() => toggleReplies(root.id, rc)}
                  disabled={th.loading}
                >
                  {th.loading
                    ? 'Đang tải...'
                    : th.expanded
                      ? 'Ẩn phản hồi'
                      : `Xem ${rc} phản hồi`}
                </button>
              )}
              {th.expanded && th.loaded && (
                <div className="matching-comment-replies">{th.items.map((r) => renderCommentRow(r, { isReply: true, rootId: root.id }))}</div>
              )}
            </div>
          );
        })}

        {hasMoreRoots && (
          <button
            type="button"
            className="btn btn-link btn-sm w-100"
            disabled={rootsLoading}
            onClick={() => loadRoots(rootsPage + 1, true)}
          >
            {rootsLoading ? '...' : 'Xem thêm bình luận'}
          </button>
        )}

        {!rootsLoading && roots.length === 0 && totalRoots === 0 && (
          <p className="text-muted text-center py-3">Chưa có bình luận. Hãy là người đầu tiên! 🏸</p>
        )}
      </div>
    </div>
  );
}

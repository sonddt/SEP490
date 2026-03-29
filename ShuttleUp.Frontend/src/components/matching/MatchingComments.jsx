import { useState, useEffect, useCallback } from 'react';
import matchingApi from '../../api/matchingApi';

const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';

export default function MatchingComments({ postId }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const load = useCallback(async (p = 1) => {
    try {
      const res = await matchingApi.getComments(postId, { page: p, pageSize });
      setComments((prev) => p === 1 ? res.items : [...prev, ...res.items]);
      setTotal(res.total);
      setPage(p);
    } catch (err) {
      console.error('Load comments error', err);
    }
  }, [postId]);

  useEffect(() => { load(1); }, [load]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await matchingApi.postComment(postId, { content: content.trim() });
      setComments((prev) => [res, ...prev]);
      setTotal((t) => t + 1);
      setContent('');
    } catch (err) {
      console.error('Post comment error', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const hasMore = comments.length < total;

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
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!content.trim() || sending}>
          {sending ? '...' : 'Gửi'}
        </button>
      </form>

      {/* ── Comments list ── */}
      <div className="matching-comments-list">
        {comments.map((c) => (
          <div key={c.id} className="matching-comment-item">
            <img
              src={c.avatarUrl || defaultAvatar}
              alt={c.fullName}
              className="matching-comment-avatar"
            />
            <div className="matching-comment-body">
              <div className="matching-comment-header">
                <span className="matching-comment-name">{c.fullName}</span>
                <span className="matching-comment-time">{formatTime(c.createdAt)}</span>
              </div>
              <p className="matching-comment-content">{c.content}</p>
            </div>
          </div>
        ))}

        {hasMore && (
          <button
            className="btn btn-link btn-sm w-100"
            onClick={() => load(page + 1)}
          >
            Xem thêm bình luận...
          </button>
        )}

        {comments.length === 0 && (
          <p className="text-muted text-center py-3">Chưa có bình luận. Hãy là người đầu tiên! 🏸</p>
        )}
      </div>
    </div>
  );
}

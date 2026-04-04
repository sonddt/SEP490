import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import chatApi from '../../api/chatApi';

const EMOJIS = ['😀', '😂', '😊', '😍', '👍', '👏', '🔥', '❤️', '🎉', '🙏', '✅', '🏸', '💪', '😅', '🤝'];

function msgId(m) {
  return m.id ?? m.Id;
}

export default function MiniChatWindow({
  win,
  boxWidth,
  rightOffset,
  zIndex,
  onClose,
  onToggleMin,
  onBringFront,
}) {
  const { user } = useAuth();
  const {
    subscribeToRoom,
    acquireRoom,
    releaseRoom,
    sendHubMessage,
  } = useChat();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendingImg, setSendingImg] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const roomId = String(win.roomId);

  useEffect(() => {
    acquireRoom(roomId);
    return () => releaseRoom(roomId);
  }, [roomId, acquireRoom, releaseRoom]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    chatApi
      .getMessages(roomId)
      .then((rows) => {
        if (!cancelled) setMessages(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setErr('Không tải được tin nhắn.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    return subscribeToRoom(roomId, (msg) => {
      setMessages((prev) =>
        prev.some((m) => msgId(m) === msgId(msg)) ? prev : [...prev, msg]
      );
    });
  }, [roomId, subscribeToRoom]);

  useEffect(() => {
    if (!win.minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, win.minimized]);

  const handleSend = async () => {
    const t = inputText.trim();
    if (!t) return;
    setErr('');
    try {
      await sendHubMessage(roomId, t, null);
      setInputText('');
    } catch (e) {
      setErr(e?.message || 'Không gửi được.');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pickEmoji = (ch) => {
    setInputText((p) => p + ch);
    setEmojiOpen(false);
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setSendingImg(true);
    setErr('');
    try {
      const res = await chatApi.uploadChatImage(roomId, file);
      const fid = res?.fileId ?? res?.FileId;
      if (!fid) throw new Error('Thiếu fileId từ server.');
      await sendHubMessage(roomId, ' ', fid);
    } catch (err2) {
      const msg =
        err2?.response?.data?.message ||
        err2?.message ||
        'Gửi ảnh thất bại.';
      setErr(msg);
    } finally {
      setSendingImg(false);
    }
  };

  const headerClick = useCallback(
    (e) => {
      if (e.target.closest('[data-chat-stop]')) return;
      onToggleMin(roomId);
    },
    [onToggleMin, roomId]
  );

  const shellMouseDown = () => onBringFront(roomId);

  const avatar = win.avatarUrl ? (
    <img
      src={win.avatarUrl}
      alt=""
      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
    />
  ) : (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
        color: '#64748b',
      }}
    >
      {(win.title || '?').charAt(0)}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label={`Chat ${win.title}`}
      onMouseDown={shellMouseDown}
      style={{
        position: 'fixed',
        bottom: 0,
        right: rightOffset,
        width: boxWidth,
        zIndex: zIndex ?? 1200,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        borderRadius: win.minimized ? '10px 10px 0 0' : '10px 10px 0 0',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        background: '#fff',
      }}
    >
      <div
        onClick={headerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
          color: '#fff',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {avatar}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {win.title}
          </div>
          <div style={{ fontSize: 11, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />
            Offline
          </div>
        </div>
        {win.minimized && (win.unread || 0) > 0 && (
          <span
            style={{
              background: '#ef4444',
              color: '#fff',
              borderRadius: 10,
              padding: '2px 7px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {win.unread > 9 ? '9+' : win.unread}
          </span>
        )}
        <button
          type="button"
          data-chat-stop
          onClick={() => onToggleMin(roomId)}
          title="Thu nhỏ"
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            width: 28,
            height: 28,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ─
        </button>
        <button
          type="button"
          data-chat-stop
          onClick={() => onClose(roomId)}
          title="Đóng"
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            width: 28,
            height: 28,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {!win.minimized && (
        <>
          {err && (
            <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
              {err}
            </div>
          )}
          <div
            style={{
              height: 280,
              overflowY: 'auto',
              padding: 10,
              background: '#f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {loading && <p style={{ color: '#64748b', fontSize: 13 }}>Đang tải…</p>}
            {!loading &&
              messages.map((msg) => {
                const isMe = String(msg.senderUserId ?? msg.SenderUserId) === String(user?.id);
                return (
                  <div
                    key={msgId(msg)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isMe && (
                      <span style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                        {msg.senderName ?? msg.SenderName}
                      </span>
                    )}
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: '8px 11px',
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? '#2563eb' : '#fff',
                        color: isMe ? '#fff' : '#1e293b',
                        fontSize: 13,
                        wordBreak: 'break-word',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }}
                    >
                      {(msg.messageText ?? msg.MessageText)?.trim() &&
                        (msg.messageText ?? msg.MessageText)}
                      {(msg.fileUrl ?? msg.FileUrl) && (
                        <img
                          src={msg.fileUrl ?? msg.FileUrl}
                          alt=""
                          style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4, display: 'block' }}
                        />
                      )}
                      <div
                        style={{
                          fontSize: 10,
                          opacity: 0.75,
                          marginTop: 4,
                          textAlign: 'right',
                        }}
                      >
                        {new Date(msg.createdAt ?? msg.CreatedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={bottomRef} />
          </div>

          <div
            style={{
              borderTop: '1px solid #e2e8f0',
              padding: 8,
              display: 'flex',
              gap: 6,
              alignItems: 'flex-end',
              background: '#fff',
            }}
          >
            <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onPickImage} />
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={sendingImg}
              title="Gửi ảnh"
              onClick={() => fileRef.current?.click()}
            >
              🖼
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                title="Cảm xúc"
                onClick={() => setEmojiOpen((o) => !o)}
              >
                😊
              </button>
              {emojiOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 6,
                    padding: 8,
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 4,
                    zIndex: 10,
                  }}
                >
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="btn btn-sm btn-light p-1"
                      onClick={() => pickEmoji(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Nhập tin nhắn…"
              style={{
                flex: 1,
                resize: 'none',
                fontSize: 13,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSend}>
              Gửi
            </button>
          </div>
        </>
      )}
    </div>
  );
}

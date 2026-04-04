import { useCallback, useEffect, useRef, useState } from 'react';
import chatApi from '../api/chatApi';
import socialApi from '../api/socialApi';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { roomIdOf } from '../utils/chatDirectRoom';

const EMOJIS = ['😀', '😂', '😊', '😍', '👍', '👏', '🔥', '❤️', '🎉', '🙏', '✅', '🏸', '💪', '😅', '🤝'];

function msgId(m) {
  return m.id ?? m.Id;
}

export default function ChatPage() {
  const { user } = useAuth();
  const {
    connStatus,
    hubConnected,
    subscribeToRoom,
    acquireRoom,
    releaseRoom,
    sendHubMessage,
  } = useChat();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [friendChoices, setFriendChoices] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState(() => new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState('');
  const [sendingImg, setSendingImg] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const activeRoomId = activeRoom ? roomIdOf(activeRoom) : null;

  const loadRooms = useCallback(() => {
    setLoadingRooms(true);
    chatApi
      .getRooms()
      .then(setRooms)
      .catch(() => setError('Không tải được danh sách room.'))
      .finally(() => setLoadingRooms(false));
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const loadFriendChoices = useCallback(() => {
    setLoadingFriends(true);
    socialApi
      .getFriends()
      .then((f) => setFriendChoices(Array.isArray(f) ? f : []))
      .catch(() => setFriendChoices([]))
      .finally(() => setLoadingFriends(false));
  }, []);

  useEffect(() => {
    if (showCreate) {
      setSelectedMemberIds(new Set());
      loadFriendChoices();
    }
  }, [showCreate, loadFriendChoices]);

  useEffect(() => {
    if (!activeRoomId) return undefined;
    acquireRoom(activeRoomId);
    return () => releaseRoom(activeRoomId);
  }, [activeRoomId, acquireRoom, releaseRoom]);

  useEffect(() => {
    if (!activeRoomId) return undefined;
    return subscribeToRoom(activeRoomId, (msg) => {
      setMessages((prev) =>
        prev.some((m) => msgId(m) === msgId(msg)) ? prev : [...prev, msg]
      );
    });
  }, [activeRoomId, subscribeToRoom]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    setError('');
    chatApi
      .getMessages(activeRoomId)
      .then((rows) => setMessages(Array.isArray(rows) ? rows : []))
      .catch(() => setError('Không tải được tin nhắn.'));
  }, [activeRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelect = (room) => {
    setActiveRoom(room);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeRoomId) return;
    if (!hubConnected) {
      setError('Chưa kết nối SignalR.');
      return;
    }
    try {
      await sendHubMessage(activeRoomId, inputText.trim(), null);
      setInputText('');
      setError('');
    } catch (e) {
      setError(e?.message || 'Lỗi gửi tin nhắn.');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMember = (id) => {
    const key = String(id);
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const memberIds = [...selectedMemberIds].map((s) => s);
    try {
      const room = await chatApi.createRoom({
        name: newName.trim(),
        memberIds,
      });
      setRooms((p) => [room, ...p]);
      setNewName('');
      setSelectedMemberIds(new Set());
      setShowCreate(false);
      handleSelect(room);
      loadRooms();
    } catch {
      setError('Tạo room thất bại.');
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !activeRoomId) return;
    if (!hubConnected) {
      setError('Chưa kết nối SignalR.');
      return;
    }
    setSendingImg(true);
    setError('');
    try {
      const res = await chatApi.uploadChatImage(activeRoomId, file);
      const fid = res?.fileId ?? res?.FileId;
      if (!fid) throw new Error('Thiếu fileId.');
      await sendHubMessage(activeRoomId, '', fid);
    } catch (err2) {
      setError(
        err2?.response?.data?.message || err2?.message || 'Gửi ảnh thất bại.'
      );
    } finally {
      setSendingImg(false);
    }
  };

  const pickEmoji = (ch) => {
    setInputText((p) => p + ch);
    setEmojiOpen(false);
  };

  const onlineLabel = hubConnected ? 'Đã kết nối ✓' : connStatus;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.left}>
          <div style={S.leftHead}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>💬 Chat</span>
            <button type="button" style={S.btnGreen} onClick={() => setShowCreate((p) => !p)}>
              {showCreate ? '✕ Huỷ' : '＋ Tạo room'}
            </button>
          </div>

          {showCreate && (
            <div style={S.createBox}>
              <label style={S.label}>Tên room *</label>
              <input
                style={S.inp}
                placeholder="VD: Nhóm đánh cầu thứ 7"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <label style={S.label}>Mời bạn bè</label>
              {loadingFriends && (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Đang tải danh sách…</p>
              )}
              {!loadingFriends && friendChoices.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                  Chưa có bạn bè — hãy thêm bạn ở mục Tìm bạn / Bạn bè.
                </p>
              )}
              <div
                style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {friendChoices.map((x) => {
                  const id = x.id ?? x.Id;
                  const name = x.fullName ?? x.FullName ?? '';
                  const checked = selectedMemberIds.has(String(id));
                  return (
                    <label
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#e2e8f0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(id)}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                style={{ ...S.btnGreen, width: '100%', padding: '9px 0', marginTop: 4 }}
                onClick={handleCreate}
              >
                ✓ Tạo
              </button>
            </div>
          )}

          <div style={S.roomList}>
            {loadingRooms && <p style={S.hint}>Đang tải...</p>}
            {!loadingRooms && rooms.length === 0 && (
              <div style={S.emptyRoom}>
                <div style={{ fontSize: 32 }}>💬</div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>Chưa có room nào</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                  Dùng <strong>＋ Tạo room</strong> hoặc mở chat từ <strong>Bạn bè</strong> / thanh bên phải.
                </div>
              </div>
            )}
            {rooms.map((r) => {
              const rid = roomIdOf(r);
              return (
                <div
                  key={rid}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(r)}
                  style={{
                    ...S.roomItem,
                    background: roomIdOf(activeRoom) === rid ? '#2563eb' : 'transparent',
                  }}
                  onClick={() => handleSelect(r)}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {r.lastMessage?.messageText?.slice(0, 38) ?? 'Chưa có tin nhắn'}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={S.statusBar}>
            <span style={{ color: hubConnected ? '#4ade80' : '#f87171', fontWeight: 700 }}>●</span>
            &nbsp;{onlineLabel}
          </div>
        </div>

        <div style={S.right}>
          {!activeRoom ? (
            <div style={S.noRoom}>
              <div style={{ fontSize: 48 }}>💬</div>
              <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: '#475569' }}>
                Chọn một room để bắt đầu chat
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
                Bạn có thể mở nhiều cửa sổ chat nhỏ ở góc màn hình khi nhắn từ danh sách bạn bè.
              </div>
            </div>
          ) : (
            <>
              <div style={S.chatHead}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{activeRoom.name}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>
                    {(activeRoom.members || activeRoom.Members || [])
                      .map((m) => m.fullName ?? m.FullName)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              </div>

              {error && <div style={S.errorBar}>⚠ {error}</div>}

              <div style={S.msgArea}>
                {messages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>
                    Chưa có tin nhắn nào. Hãy gửi tin đầu tiên!
                  </p>
                )}
                {messages.map((msg) => {
                  const isMe = String(msg.senderUserId ?? msg.SenderUserId) === String(user?.id);
                  const text = (msg.messageText ?? msg.MessageText)?.trim();
                  const img = msg.fileUrl ?? msg.FileUrl;
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
                        <span
                          style={{
                            fontSize: 11,
                            color: '#64748b',
                            marginBottom: 2,
                            marginLeft: 4,
                          }}
                        >
                          {msg.senderName ?? msg.SenderName}
                        </span>
                      )}
                      <div
                        style={{
                          ...S.bubble,
                          background: isMe ? '#2563eb' : '#e2e8f0',
                          color: isMe ? '#fff' : '#1e293b',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}
                      >
                        {text}
                        {img && (
                          <img
                            src={img}
                            alt=""
                            style={{
                              maxWidth: 200,
                              borderRadius: 8,
                              marginTop: text ? 6 : 0,
                              display: 'block',
                            }}
                          />
                        )}
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.65,
                            textAlign: 'right',
                            marginTop: 4,
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

              <div style={S.inputRow}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={onPickImage}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={sendingImg}
                  title="Gửi ảnh"
                  onClick={() => fileRef.current?.click()}
                >
                  🖼
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
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
                        marginBottom: 8,
                        padding: 8,
                        background: '#fff',
                        borderRadius: 10,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 4,
                        zIndex: 20,
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
                  style={S.textarea}
                  rows={2}
                  placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={onKey}
                />
                <button type="button" style={S.btnBlue} onClick={handleSend}>
                  Gửi ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '90px 16px 24px 16px',
    boxSizing: 'border-box',
    minHeight: '100vh',
  },
  wrap: {
    display: 'flex',
    width: '100%',
    maxWidth: 960,
    height: 'calc(100vh - 130px)',
    minHeight: 520,
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  left: {
    width: 280,
    background: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  leftHead: {
    padding: '16px',
    background: '#0f172a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#f1f5f9',
    borderBottom: '1px solid #334155',
  },
  createBox: {
    padding: '12px',
    background: '#0f172a',
    borderBottom: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' },
  inp: {
    background: '#1e293b',
    border: '1px solid #475569',
    borderRadius: 6,
    color: '#f1f5f9',
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  roomList: { flex: 1, overflowY: 'auto' },
  roomItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #334155',
    transition: 'background 0.15s',
  },
  emptyRoom: {
    padding: '32px 16px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  hint: { padding: '12px 16px', color: '#64748b', fontSize: 13 },
  statusBar: {
    padding: '10px 16px',
    borderTop: '1px solid #334155',
    fontSize: 12,
    color: '#94a3b8',
    background: '#0f172a',
  },
  right: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
  },
  noRoom: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
  },
  chatHead: {
    padding: '14px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
  },
  errorBar: {
    background: '#fee2e2',
    color: '#dc2626',
    padding: '8px 16px',
    fontSize: 13,
  },
  msgArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#f8fafc',
  },
  bubble: {
    maxWidth: '68%',
    padding: '10px 14px',
    fontSize: 14,
    wordBreak: 'break-word',
    lineHeight: 1.5,
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
    background: '#fff',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  btnGreen: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 13px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  btnBlue: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
};

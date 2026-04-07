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
  /* Messenger mobile: true = showing chat, false = showing room list */
  const [mobileShowChat, setMobileShowChat] = useState(false);

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
    setMobileShowChat(true); // on mobile, switch to chat view
  };

  const handleBackToRooms = () => {
    setMobileShowChat(false);
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
    <div className="chat-page">
      <div className="chat-wrap">
        {/* ── Sidebar (Room List) ── */}
        <div className={`chat-sidebar${mobileShowChat ? ' chat-sidebar--hidden' : ''}`}>
          <div className="chat-sidebar-head">
            <span style={{ fontWeight: 700, fontSize: 16 }}>💬 Chat</span>
            <button type="button" className="chat-btn-green" onClick={() => setShowCreate((p) => !p)}>
              {showCreate ? '✕ Huỷ' : '＋ Tạo room'}
            </button>
          </div>

          {showCreate && (
            <div className="chat-sidebar-create">
              <label className="chat-sidebar-label">Tên room *</label>
              <input
                className="chat-sidebar-input"
                placeholder="VD: Nhóm đánh cầu thứ 7"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <label className="chat-sidebar-label">Mời bạn bè</label>
              {loadingFriends && (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Đang tải danh sách…</p>
              )}
              {!loadingFriends && friendChoices.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                  Chưa có bạn bè — hãy thêm bạn ở mục Tìm bạn / Bạn bè.
                </p>
              )}
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {friendChoices.map((x) => {
                  const id = x.id ?? x.Id;
                  const name = x.fullName ?? x.FullName ?? '';
                  const checked = selectedMemberIds.has(String(id));
                  return (
                    <label
                      key={id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e2e8f0' }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleMember(id)} />
                      {name}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="chat-btn-green"
                style={{ width: '100%', padding: '9px 0', marginTop: 4 }}
                onClick={handleCreate}
              >
                ✓ Tạo
              </button>
            </div>
          )}

          <div className="chat-room-list">
            {loadingRooms && <p style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>Đang tải...</p>}
            {!loadingRooms && rooms.length === 0 && (
              <div className="chat-room-empty">
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
                  className="chat-room-item"
                  style={{ background: roomIdOf(activeRoom) === rid ? '#2563eb' : 'transparent' }}
                  onClick={() => handleSelect(r)}
                >
                  <div className="chat-room-item-name">{r.name}</div>
                  <div className="chat-room-item-last">
                    {r.lastMessage?.messageText?.slice(0, 38) ?? 'Chưa có tin nhắn'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="chat-status-bar">
            <span style={{ color: hubConnected ? '#4ade80' : '#f87171', fontWeight: 700 }}>●</span>
            &nbsp;{onlineLabel}
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div className={`chat-main${!mobileShowChat ? ' chat-main--hidden' : ''}`}>
          {!activeRoom ? (
            <div className="chat-no-room">
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
              <div className="chat-head">
                <button type="button" className="chat-back-btn" onClick={handleBackToRooms} title="Quay lại">
                  <i className="feather-arrow-left"></i>
                </button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="chat-head-title">{activeRoom.name}</span>
                  <div className="chat-head-members">
                    {(activeRoom.members || activeRoom.Members || [])
                      .map((m) => m.fullName ?? m.FullName)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              </div>

              {error && <div className="chat-error-bar">⚠ {error}</div>}

              <div className="chat-msg-area">
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
                      style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      {!isMe && (
                        <span style={{ fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4 }}>
                          {msg.senderName ?? msg.SenderName}
                        </span>
                      )}
                      <div
                        className="chat-bubble"
                        style={{
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
                            style={{ marginTop: text ? 6 : 0 }}
                          />
                        )}
                        <div style={{ fontSize: 10, opacity: 0.65, textAlign: 'right', marginTop: 4 }}>
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

              <div className="chat-input-row">
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
                    <div className="chat-emoji-picker">
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
                  className="chat-textarea"
                  rows={2}
                  placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={onKey}
                />
                <button type="button" className="chat-btn-blue" onClick={handleSend}>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import chatApi from '../../api/chatApi';
import socialApi from '../../api/socialApi';
import { findDirectRoom, roomIdOf } from '../../utils/chatDirectRoom';

const EMOJIS = ['😀', '😂', '😊', '😍', '👍', '👏', '🔥', '❤️', '🎉', '🙏', '✅', '🏸', '💪', '😅', '🤝'];

function msgId(m) { return m.id ?? m.Id; }

export default function ChatPanel() {
    const { user } = useAuth();
    const {
        chatPanelOpen, closeChatPanel,
        connStatus, hubConnected,
        subscribeToRoom, acquireRoom, releaseRoom, sendHubMessage,
        openChatWithPeer,
    } = useChat();

    /* ─── state ──────────────────────────────────────── */
    const [friends, setFriends] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [sendingImg, setSendingImg] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [tab, setTab] = useState('rooms'); // 'rooms' | 'friends'

    const bottomRef = useRef(null);
    const fileRef = useRef(null);
    const activeRoomId = activeRoom ? roomIdOf(activeRoom) : null;

    /* ─── load data when panel opens ─────────────────── */
    useEffect(() => {
        if (!chatPanelOpen) return;
        setLoadingRooms(true);
        chatApi.getRooms()
            .then(r => setRooms(Array.isArray(r) ? r : []))
            .catch(() => { })
            .finally(() => setLoadingRooms(false));

        setLoadingFriends(true);
        socialApi.getFriends()
            .then(f => setFriends(Array.isArray(f) ? f : []))
            .catch(() => setFriends([]))
            .finally(() => setLoadingFriends(false));
    }, [chatPanelOpen]);

    /* ─── room subscription ──────────────────────────── */
    useEffect(() => {
        if (!activeRoomId) return undefined;
        acquireRoom(activeRoomId);
        return () => releaseRoom(activeRoomId);
    }, [activeRoomId, acquireRoom, releaseRoom]);

    useEffect(() => {
        if (!activeRoomId) return undefined;
        return subscribeToRoom(activeRoomId, (msg) => {
            setMessages(prev =>
                prev.some(m => msgId(m) === msgId(msg)) ? prev : [...prev, msg]
            );
        });
    }, [activeRoomId, subscribeToRoom]);

    useEffect(() => {
        if (!activeRoomId) { setMessages([]); return; }
        chatApi.getMessages(activeRoomId)
            .then(rows => setMessages(Array.isArray(rows) ? rows : []))
            .catch(() => { });
    }, [activeRoomId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    /* ─── handlers ───────────────────────────────────── */
    const handleSelectRoom = (room) => {
        setActiveRoom(room);
    };

    const handleFriendClick = useCallback(async (f) => {
        const id = f.id ?? f.Id;
        const name = f.fullName ?? f.FullName ?? '';
        const av = f.avatarUrl ?? f.AvatarUrl;
        if (!user?.id || !id) return;

        try {
            const allRooms = await chatApi.getRooms();
            const list = Array.isArray(allRooms) ? allRooms : [];
            let room = findDirectRoom(list, user.id, id);
            if (!room) {
                room = await chatApi.createRoom({
                    name: `Chat với ${name || 'Bạn bè'}`,
                    memberIds: [id],
                });
            }
            setRooms(prev => {
                const rid = roomIdOf(room);
                if (prev.some(r => String(roomIdOf(r)) === String(rid))) return prev;
                return [room, ...prev];
            });
            setActiveRoom(room);
            setTab('rooms');
        } catch { }
    }, [user?.id]);

    const handleSend = async () => {
        if (!inputText.trim() || !activeRoomId || !hubConnected) return;
        try {
            await sendHubMessage(activeRoomId, inputText.trim(), null);
            setInputText('');
        } catch { }
    };

    const onKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const onPickImage = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/') || !activeRoomId || !hubConnected) return;
        setSendingImg(true);
        try {
            const res = await chatApi.uploadChatImage(activeRoomId, file);
            const fid = res?.fileId ?? res?.FileId;
            if (fid) await sendHubMessage(activeRoomId, '', fid);
        } catch { } finally { setSendingImg(false); }
    };

    const pickEmoji = (ch) => { setInputText(p => p + ch); setEmojiOpen(false); };

    const handleBack = () => setActiveRoom(null);

    /* ─── render ─────────────────────────────────────── */
    if (!chatPanelOpen) return null;

    const onlineLabel = hubConnected ? '● Đã kết nối' : connStatus;

    return (
        <div className="shuttle-chat-panel" onClick={e => e.stopPropagation()}>
            {/* ── Header ── */}
            <div className="shuttle-chat-panel__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="shuttle-chat-panel__header-icon">
                        <i className="fa-solid fa-comments"></i>
                    </div>
                    <div>
                        <h4 className="shuttle-chat-panel__title">Tin nhắn</h4>
                        <span className={`shuttle-chat-panel__status ${hubConnected ? '--online' : ''}`}>{onlineLabel}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button className="shuttle-chat-panel__btn" onClick={closeChatPanel} title="Đóng">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="shuttle-chat-panel__body">
                {/* Left: room/friend list */}
                {!activeRoom ? (
                    <div className="shuttle-chat-panel__list">
                        {/* Tabs */}
                        <div className="shuttle-chat-panel__tabs">
                            <button
                                className={`shuttle-chat-panel__tab ${tab === 'rooms' ? '--active' : ''}`}
                                onClick={() => setTab('rooms')}
                            >
                                <i className="fa-solid fa-comments"></i> Chat
                            </button>
                            <button
                                className={`shuttle-chat-panel__tab ${tab === 'friends' ? '--active' : ''}`}
                                onClick={() => setTab('friends')}
                            >
                                <i className="fa-solid fa-user-group"></i> Bạn bè
                            </button>
                        </div>

                        <div className="shuttle-chat-panel__scroll">
                            {tab === 'rooms' && (
                                <>
                                    {loadingRooms && (
                                        <div className="shuttle-chat-panel__empty">
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                        </div>
                                    )}
                                    {!loadingRooms && rooms.length === 0 && (
                                        <div className="shuttle-chat-panel__empty">
                                            <i className="fa-regular fa-comments" style={{ fontSize: 28, marginBottom: 8 }}></i>
                                            <span>Chưa có tin nhắn</span>
                                        </div>
                                    )}
                                    {rooms.map(r => {
                                        const rid = roomIdOf(r);
                                        return (
                                            <button key={rid} className="shuttle-chat-panel__room-item" onClick={() => handleSelectRoom(r)}>
                                                <div className="shuttle-chat-panel__room-avatar">
                                                    <img src="/assets/img/profiles/avatar-02.jpg" alt="" />
                                                    <span className="shuttle-chat-panel__online-dot"></span>
                                                </div>
                                                <div className="shuttle-chat-panel__room-info">
                                                    <span className="shuttle-chat-panel__room-name">{r.name}</span>
                                                    <span className="shuttle-chat-panel__room-last">
                                                        {r.lastMessage?.messageText ?? 'Chưa có tin nhắn'}
                                                    </span>
                                                </div>
                                                {r.lastMessage?.createdAt && (
                                                    <span className="shuttle-chat-panel__room-time">
                                                        {new Date(r.lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                            {tab === 'friends' && (
                                <>
                                    {loadingFriends && (
                                        <div className="shuttle-chat-panel__empty">
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                        </div>
                                    )}
                                    {!loadingFriends && friends.length === 0 && (
                                        <div className="shuttle-chat-panel__empty">
                                            <i className="fa-solid fa-user-group" style={{ fontSize: 28, marginBottom: 8 }}></i>
                                            <span>Chưa có bạn bè</span>
                                        </div>
                                    )}
                                    {friends.map(f => {
                                        const id = f.id ?? f.Id;
                                        const name = f.fullName ?? f.FullName ?? '';
                                        const av = f.avatarUrl ?? f.AvatarUrl;
                                        return (
                                            <button key={id} className="shuttle-chat-panel__room-item" onClick={() => handleFriendClick(f)}>
                                                <div className="shuttle-chat-panel__room-avatar">
                                                    {av ? <img src={av} alt="" /> : (
                                                        <span className="shuttle-chat-panel__avatar-fallback">{(name || '?').charAt(0)}</span>
                                                    )}
                                                    <span className="shuttle-chat-panel__online-dot"></span>
                                                </div>
                                                <div className="shuttle-chat-panel__room-info">
                                                    <span className="shuttle-chat-panel__room-name">{name}</span>
                                                    <span className="shuttle-chat-panel__room-last">Nhấn để chat</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Right: active chat */
                    <div className="shuttle-chat-panel__chat">
                        {/* Chat header */}
                        <div className="shuttle-chat-panel__chat-header">
                            <button className="shuttle-chat-panel__back-btn" onClick={handleBack}>
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                            <div className="shuttle-chat-panel__room-avatar" style={{ width: 32, height: 32 }}>
                                <img src="/assets/img/profiles/avatar-02.jpg" alt="" style={{ width: 32, height: 32 }} />
                            </div>
                            <span className="shuttle-chat-panel__chat-name">{activeRoom.name}</span>
                        </div>

                        {/* Messages */}
                        <div className="shuttle-chat-panel__messages">
                            <div className="shuttle-chat-panel__msg-list">
                                {messages.map(msg => {
                                    const isMe = String(msg.senderUserId ?? msg.SenderUserId) === String(user?.id);
                                    const text = (msg.messageText ?? msg.MessageText)?.trim();
                                    const img = msg.fileUrl ?? msg.FileUrl;
                                    const timeStr = new Date(msg.createdAt ?? msg.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={msgId(msg)} className={`shuttle-chat-panel__bubble ${isMe ? '--me' : '--other'}`}>
                                            {!isMe && <span className="shuttle-chat-panel__sender">{msg.senderName ?? msg.SenderName}</span>}
                                            <div className={`shuttle-chat-panel__msg ${isMe ? '--me' : '--other'}`}>
                                                {text && <p>{text}</p>}
                                                {img && <img src={img} alt="" className="shuttle-chat-panel__msg-img" />}
                                                <span className="shuttle-chat-panel__msg-time">{timeStr}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        </div>

                        {/* Input */}
                        <div className="shuttle-chat-panel__input-area">
                            {emojiOpen && (
                                <div className="shuttle-chat-panel__emoji-picker">
                                    {EMOJIS.map(em => (
                                        <button key={em} type="button" className="shuttle-chat-panel__emoji-btn" onClick={() => pickEmoji(em)}>{em}</button>
                                    ))}
                                </div>
                            )}
                            <div className="shuttle-chat-panel__input-row">
                                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
                                <button className="shuttle-chat-panel__action-btn" onClick={() => fileRef.current?.click()} disabled={sendingImg} title="Gửi ảnh">
                                    <i className={sendingImg ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-image'}></i>
                                </button>
                                <button className={`shuttle-chat-panel__action-btn ${emojiOpen ? '--active' : ''}`} onClick={() => setEmojiOpen(o => !o)}>
                                    <i className="fa-regular fa-face-smile"></i>
                                </button>
                                <input
                                    className="shuttle-chat-panel__text-input"
                                    placeholder="Nhập tin nhắn..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={onKey}
                                />
                                <button className="shuttle-chat-panel__send-btn" onClick={handleSend} disabled={!inputText.trim()}>
                                    <i className="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

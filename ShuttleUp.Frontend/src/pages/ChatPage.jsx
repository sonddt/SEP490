import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import chatApi from '../api/chatApi';
import { useAuth } from '../context/AuthContext';

const HUB_URL = 'http://localhost:5079/hubs/chat';

export default function ChatPage() {
    const { user } = useAuth();

    const [rooms, setRooms]             = useState([]);
    const [activeRoom, setActiveRoom]   = useState(null);
    const [messages, setMessages]       = useState([]);
    const [inputText, setInputText]     = useState('');
    const [connStatus, setConnStatus]   = useState('Đang kết nối...');
    const [showCreate, setShowCreate]   = useState(false);
    const [newName, setNewName]         = useState('');
    const [newMembers, setNewMembers]   = useState('');
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [error, setError]             = useState('');

    const connRef      = useRef(null);
    const bottomRef    = useRef(null);

    // ── SignalR ────────────────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        const conn = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { accessTokenFactory: () => token })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        conn.on('ReceiveMessage', (msg) => setMessages(p => [...p, msg]));
        // MessageSent: fallback khi người gửi chưa trong group
        conn.on('MessageSent', (msg) => {
            setMessages(p => p.some(m => m.id === msg.id) ? p : [...p, msg]);
        });
        conn.on('Error', (err) => console.error('Hub Error:', err));
        conn.onreconnecting(() => setConnStatus('Kết nối lại...'));
        conn.onreconnected(async () => {
            setConnStatus('Đã kết nối ✓');
            // Sau khi reconnect, join lại room đang active
            setActiveRoom(prev => {
                if (prev) conn.invoke('JoinRoom', prev.id).catch(console.error);
                return prev;
            });
        });
        conn.onclose(() => setConnStatus('Mất kết nối ✗'));

        conn.start()
            .then(() => { setConnStatus('Đã kết nối ✓'); connRef.current = conn; })
            .catch(() => setConnStatus('Backend chưa chạy ✗'));

        return () => conn.stop();
    }, []);

    // ── Load rooms ─────────────────────────────────────────────────────────
    useEffect(() => {
        setLoadingRooms(true);
        chatApi.getRooms()
            .then(setRooms)
            .catch(() => setError('Không tải được danh sách room. Kiểm tra backend.'))
            .finally(() => setLoadingRooms(false));
    }, []);

    // ── Select room ────────────────────────────────────────────────────────
    const handleSelect = async (room) => {
        if (activeRoom && connRef.current?.state === 'Connected')
            await connRef.current.invoke('LeaveRoom', activeRoom.id);

        setActiveRoom(room);
        setMessages([]);
        setError('');

        try {
            const history = await chatApi.getMessages(room.id);
            setMessages(history);
        } catch { setError('Không tải được tin nhắn.'); }

        if (connRef.current?.state === 'Connected')
            await connRef.current.invoke('JoinRoom', room.id);
    };

    // ── Send ───────────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!inputText.trim() || !activeRoom) return;
        if (connRef.current?.state !== 'Connected') {
            setError('Chưa kết nối SignalR. Backend đang chạy chưa?');
            return;
        }
        try {
            await connRef.current.invoke('SendMessage', activeRoom.id, inputText.trim(), null);
            setInputText('');
            setError('');
        } catch (e) {
            console.error('SendMessage error:', e);
            setError(e?.message ?? 'Lỗi không xác định khi gửi tin nhắn.');
        }
    };

    const onKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // ── Create room ────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!newName.trim()) return;
        const memberIds = newMembers.split(',').map(s => s.trim()).filter(Boolean);
        try {
            const room = await chatApi.createRoom({ name: newName, memberIds });
            setRooms(p => [room, ...p]);
            setNewName(''); setNewMembers(''); setShowCreate(false);
            handleSelect(room);
        } catch { setError('Tạo room thất bại.'); }
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const isOnline = connStatus.includes('✓');

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={S.page}>
            <div style={S.wrap}>

                {/* ── LEFT: Room list ── */}
                <div style={S.left}>

                    {/* Header */}
                    <div style={S.leftHead}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>💬 Chat</span>
                        <button style={S.btnGreen} onClick={() => setShowCreate(p => !p)}>
                            {showCreate ? '✕ Huỷ' : '＋ Tạo room'}
                        </button>
                    </div>

                    {/* Create form */}
                    {showCreate && (
                        <div style={S.createBox}>
                            <label style={S.label}>Tên room *</label>
                            <input
                                style={S.inp}
                                placeholder="VD: Nhóm đánh cầu thứ 7"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                            <label style={S.label}>Mời thành viên (User ID, phân cách dấu phẩy)</label>
                            <input
                                style={S.inp}
                                placeholder="Để trống nếu chỉ mình bạn"
                                value={newMembers}
                                onChange={e => setNewMembers(e.target.value)}
                            />
                            <button style={{ ...S.btnGreen, width: '100%', padding: '9px 0', marginTop: 4 }}
                                onClick={handleCreate}>
                                ✓ Tạo
                            </button>
                        </div>
                    )}

                    {/* Room list */}
                    <div style={S.roomList}>
                        {loadingRooms && <p style={S.hint}>Đang tải...</p>}
                        {!loadingRooms && rooms.length === 0 && (
                            <div style={S.emptyRoom}>
                                <div style={{ fontSize: 32 }}>💬</div>
                                <div style={{ marginTop: 8, fontWeight: 600 }}>Chưa có room nào</div>
                                <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                                    Bấm <strong>＋ Tạo room</strong> ở trên để bắt đầu
                                </div>
                            </div>
                        )}
                        {rooms.map(r => (
                            <div key={r.id}
                                style={{
                                    ...S.roomItem,
                                    background: activeRoom?.id === r.id ? '#2563eb' : 'transparent',
                                }}
                                onClick={() => handleSelect(r)}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>
                                    {r.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                    {r.lastMessage?.messageText?.slice(0, 38) ?? 'Chưa có tin nhắn'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Status badge */}
                    <div style={S.statusBar}>
                        <span style={{ color: isOnline ? '#4ade80' : '#f87171', fontWeight: 700 }}>●</span>
                        &nbsp;{connStatus}
                    </div>
                </div>

                {/* ── RIGHT: Chat area ── */}
                <div style={S.right}>
                    {!activeRoom ? (
                        <div style={S.noRoom}>
                            <div style={{ fontSize: 48 }}>💬</div>
                            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: '#475569' }}>
                                Chọn một room để bắt đầu chat
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
                                Hoặc tạo room mới ở cột bên trái
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div style={S.chatHead}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: 16 }}>{activeRoom.name}</span>
                                    <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>
                                        {activeRoom.members?.map(m => m.fullName).join(', ')}
                                    </span>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={S.errorBar}>⚠ {error}</div>
                            )}

                            {/* Messages */}
                            <div style={S.msgArea}>
                                {messages.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>
                                        Chưa có tin nhắn nào. Hãy gửi tin đầu tiên!
                                    </p>
                                )}
                                {messages.map(msg => {
                                    const isMe = msg.senderUserId === user?.id;
                                    return (
                                        <div key={msg.id} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isMe ? 'flex-end' : 'flex-start',
                                        }}>
                                            {!isMe && (
                                                <span style={{ fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4 }}>
                                                    {msg.senderName}
                                                </span>
                                            )}
                                            <div style={{
                                                ...S.bubble,
                                                background: isMe ? '#2563eb' : '#e2e8f0',
                                                color: isMe ? '#fff' : '#1e293b',
                                                borderRadius: isMe
                                                    ? '16px 16px 4px 16px'
                                                    : '16px 16px 16px 4px',
                                            }}>
                                                {msg.messageText}
                                                {msg.fileUrl && (
                                                    <img src={msg.fileUrl} alt="img"
                                                        style={{ maxWidth: 200, borderRadius: 8, marginTop: 6, display: 'block' }} />
                                                )}
                                                <div style={{ fontSize: 10, opacity: 0.65, textAlign: 'right', marginTop: 4 }}>
                                                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {/* Input */}
                            <div style={S.inputRow}>
                                <textarea
                                    style={S.textarea}
                                    rows={2}
                                    placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={onKey}
                                />
                                <button style={S.btnBlue} onClick={handleSend}>Gửi ➤</button>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
    page: {
        background: '#f1f5f9',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '90px 16px 24px 16px',   /* 90px để tránh navbar fixed */
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

    // Left sidebar
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

    // Right main
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

    // Buttons
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

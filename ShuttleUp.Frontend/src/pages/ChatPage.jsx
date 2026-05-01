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
    <div>
      <div className="chat-app-wrapper shadow-xl border border-slate-100 rounded-2xl overflow-hidden bg-white flex mx-auto w-full" style={{ height: 'calc(100vh - 180px)', minHeight: '500px', maxHeight: '750px' }}>
        {/* Chat Left */}
        <div className={`chat-sidebar-left border-r border-slate-200 bg-white w-full md:w-[350px] flex-shrink-0 flex flex-col transition-all duration-300 md:min-w-[350px] h-full ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="chat-header border-b border-slate-100 p-4 bg-white flex items-center justify-between z-10">
            <h3 className="text-xl font-bold text-slate-800 m-0 flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <i className="fa-solid fa-messages text-lg"></i>
              </div>
              Tin nhắn
            </h3>
            <button
              type="button"
              className="w-10 h-10 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 rounded-xl flex items-center justify-center transition-all"
              title="Tạo phòng chat mới"
              onClick={() => setShowCreate((p) => !p)}
            >
              <i className={showCreate ? "fa-solid fa-xmark" : "fa-solid fa-plus"}></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar relative bg-slate-50/50">
            {showCreate ? (
              <div className="p-5 animate-fade-in bg-white border-b border-emerald-50 mb-2 shadow-sm">
                <div className="mb-4">
                  <label className="text-[13px] font-bold text-slate-600 mb-2 block">Tên phòng chat</label>
                  <input
                    className="form-control rounded-xl border-slate-200 py-2.5 px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-sm bg-slate-50"
                    placeholder="VD: Hội cầu lông T7..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="mb-4">
                  <label className="text-[13px] font-bold text-slate-600 mb-2 flex justify-between items-center">
                    <span>Mời bạn bè</span>
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{selectedMemberIds.size} đã chọn</span>
                  </label>

                  <div className="max-h-[200px] overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                    {loadingFriends && <div className="text-center py-4 text-emerald-500"><i className="fa-solid fa-spinner fa-spin"></i></div>}
                    {!loadingFriends && friendChoices.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-xl border-slate-200">Chưa có bạn bè nào.</p>
                    )}
                    {friendChoices.map((x) => {
                      const id = String(x.id ?? x.Id);
                      const name = x.fullName ?? x.FullName ?? '';
                      const checked = selectedMemberIds.has(id);
                      return (
                        <label key={id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${checked ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-slate-50 border-transparent'}`}>
                          <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                            {checked && <i className="fa-solid fa-check text-[10px]"></i>}
                          </div>
                          <input type="checkbox" className="d-none" checked={checked} onChange={() => toggleMember(id)} />
                          <div className="flex items-center gap-2">
                            <img src="/assets/img/profiles/avatar-02.jpg" alt="" className="w-6 h-6 rounded-full" />
                            <span className={`text-[13.5px] ${checked ? 'font-bold text-emerald-800' : 'font-semibold text-slate-700'}`}>{name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold py-2.5 rounded-xl shadow-[0_4px_12px_rgba(5,150,105,0.2)] transition-all flex items-center justify-center gap-2"
                  onClick={handleCreate}
                >
                  <i className="fa-solid fa-check"></i> Xác nhận tạo phòng
                </button>
              </div>
            ) : (
              <>
                <form className="p-4 bg-white border-b border-slate-100 sticky top-0 z-10 w-full shadow-sm">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input type="text" className="form-control rounded-full border-slate-200 py-2.5 !pl-11 pr-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-[13.5px] font-semibold bg-slate-50/50" placeholder="Tìm kiếm liên hệ..." />
                  </div>
                </form>
                <div className="chat-users-list p-2">
                  {loadingRooms && <div className="text-center py-8 text-emerald-500"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>}
                  {!loadingRooms && rooms.length === 0 && (
                    <div className="text-center py-10 px-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <i className="fa-regular fa-comments text-2xl text-slate-400"></i>
                      </div>
                      <h6 className="text-[15px] font-bold text-slate-700 mb-1">Chưa có tin nhắn</h6>
                      <p className="text-[13px] text-slate-500 leading-relaxed">Hãy kết nối với các người chơi khác hoặc người quản lý sân ngay nhé!</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {rooms.map((r) => {
                      const rid = roomIdOf(r);
                      const isActive = roomIdOf(activeRoom) === rid;
                      return (
                        <button
                          key={rid}
                          className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl transition-all border ${isActive
                            ? 'bg-emerald-50 border-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.1)] relative'
                            : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                            }`}
                          onClick={() => handleSelect(r)}
                        >
                          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-emerald-500 rounded-r-full"></div>}
                          <div className="relative flex-shrink-0">
                            <img src="/assets/img/profiles/avatar-02.jpg" alt="" className="w-12 h-12 rounded-full object-cover shadow-sm bg-white p-0.5 border border-slate-200" />
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h6 className={`text-[15px] font-bold truncate ${isActive ? 'text-emerald-800' : 'text-slate-800'}`}>{r.name}</h6>
                              <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">
                                {r.lastMessage?.createdAt ? new Date(r.lastMessage.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className={`text-[13px] truncate m-0 ${isActive ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                              {r.lastMessage?.messageText ?? 'Chưa có tin nhắn'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* /Chat Left */}

        {/* Chat Right */}
        <div className={`chat-main-right flex flex-col w-full h-full bg-white transition-all duration-300 flex-1 ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50">
              <img src="/assets/img/chat/empty-chat.svg" alt="" className="w-64 opacity-60 mb-6" onError={(e) => e.target.style.display = 'none'} />
              <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6">
                <i className="fa-brands fa-rocketchat text-5xl text-emerald-500"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Bắt đầu trò chuyện</h2>
              <p className="text-slate-500 text-[15px]">Chọn một cuộc hội thoại hoặc tạo phòng mới để kết nối ngay.</p>
            </div>
          ) : (
            <>
              <div className="chat-header shadow-sm border-b border-slate-100 p-4 px-6 bg-white flex items-center justify-between z-10 shrink-0 h-[73px]">
                <div className="flex items-center gap-4">
                  <button className="md:hidden w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center" onClick={handleBackToRooms}>
                    <i className="feather-chevron-left text-lg"></i>
                  </button>
                  <div className="relative">
                    <img src="/assets/img/profiles/avatar-02.jpg" alt="User" className="w-12 h-12 rounded-full border shadow-sm" />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div>
                    <h6 className="text-[17px] font-bold text-slate-800 mb-0.5">{activeRoom.name}</h6>
                    <p className="text-[12.5px] text-emerald-600 font-semibold m-0 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Tham gia: {(activeRoom.members || activeRoom.Members || []).map((m) => m.fullName ?? m.FullName).filter(Boolean).slice(0, 3).join(', ')}{(activeRoom.members?.length > 3) ? '...' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-all flex items-center justify-center border border-transparent hover:border-slate-200">
                    <i className="feather-phone text-lg"></i>
                  </button>
                  <button className="w-10 h-10 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-all flex items-center justify-center border border-transparent hover:border-slate-200">
                    <i className="feather-video text-lg"></i>
                  </button>
                  <div className="dropdown">
                    <button className="w-10 h-10 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center" data-bs-toggle="dropdown">
                      <i className="fas fa-ellipsis-v"></i>
                    </button>
                    <div className="dropdown-menu dropdown-menu-end border-0 shadow-lg rounded-xl overflow-hidden mt-2 p-0">
                      <div className="p-2">
                        <a className="dropdown-item py-2 px-3 rounded-lg hover:bg-slate-50 text-[14px] font-semibold flex items-center gap-2" href="#"><i className="feather-archive text-slate-400"></i> Lưu trữ</a>
                        <a className="dropdown-item py-2 px-3 rounded-lg hover:bg-slate-50 text-[14px] font-semibold flex items-center gap-2" href="#"><i className="feather-mic-off text-slate-400"></i> Tắt thông báo</a>
                        <div className="border-t border-slate-100 my-1"></div>
                        <a className="dropdown-item py-2 px-3 rounded-lg hover:bg-rose-50 text-rose-600 text-[14px] font-semibold flex items-center gap-2" href="#"><i className="feather-trash-2"></i> Xóa lịch sử</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="chat-body flex-1 overflow-y-auto bg-[url('/assets/img/bg/chat-bg.jpg')] bg-repeat bg-center relative z-0 Custom-Scrollbar p-6" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/cubes.png')`, backgroundColor: '#f8fafc' }}>
                {error && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-rose-500/90 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold backdrop-blur-md flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

                <div className="chat-scroll flex flex-col justify-end min-h-full">
                  <ul className="list-unstyled space-y-4 m-0">
                    <li className="text-center my-6">
                      <span className="bg-white border border-slate-200 text-slate-500 text-[12px] font-bold px-4 py-1.5 rounded-full shadow-sm">Bắt đầu cuộc hội thoại</span>
                    </li>

                    {messages.map((msg) => {
                      const isMe = String(msg.senderUserId ?? msg.SenderUserId) === String(user?.id);
                      const text = (msg.messageText ?? msg.MessageText)?.trim();
                      const img = msg.fileUrl ?? msg.FileUrl;
                      const timeStr = new Date(msg.createdAt ?? msg.CreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <li key={msgId(msg)} className={`media flex gap-3 ${isMe ? 'flex-row-reverse sent' : 'received'}`}>
                          <div className="avatar flex-shrink-0 self-end mb-1">
                            <img src={isMe ? (user.avatarUrl || '/assets/img/profiles/avatar-01.jpg') : '/assets/img/profiles/avatar-03.jpg'} alt="" className="w-8 h-8 rounded-full border shadow-sm" />
                          </div>
                          <div className={`media-body flex flex-col max-w-[70%] group ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && <span className="text-[11.5px] font-bold text-slate-500 ms-1 mb-1">{msg.senderName ?? msg.SenderName}</span>}
                            <div className="relative">
                              <div className={`msg-box p-3.5 shadow-sm text-[14.5px] leading-relaxed relative ${isMe
                                ? 'bg-emerald-600 text-white rounded-[20px_20px_4px_20px]'
                                : 'bg-white text-slate-800 border border-slate-100 rounded-[20px_20px_20px_4px]'
                                }`}>
                                {text && <p className="m-0 break-words">{text}</p>}
                                {img && (
                                  <div className={`rounded-xl overflow-hidden ${text ? 'mt-3' : ''}`}>
                                    <img src={img} alt="attachment" className="max-w-full max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                                  </div>
                                )}
                                <ul className={`chat-msg-info flex items-center justify-end gap-1 mt-1.5 m-0 p-0 list-none ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                  <li>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold">{timeStr}</span>
                                      {isMe && <span className="text-[12px]"><i className="fa-solid fa-check-double drop-shadow-sm"></i></span>}
                                    </div>
                                  </li>
                                </ul>
                              </div>
                              <div className={`hidden relative lg:group-hover:flex items-center absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-12' : '-right-12'}`}>
                                <button className="w-8 h-8 rounded-full bg-white border shadow-md text-slate-500 hover:text-emerald-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"><i className="fa-solid fa-ellipsis-v text-xs"></i></button>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div ref={bottomRef} />
                </div>
              </div>

              <div className="chat-footer bg-white p-4 border-t border-slate-100 z-10 shrink-0">
                <div className="bg-slate-50 rounded-2xl flex items-end p-2 border border-slate-200 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:bg-white transition-all shadow-input">
                  <div className="flex items-center pb-1 pl-1">
                    <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onPickImage} />
                    <button type="button" className="w-10 h-10 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all flex items-center justify-center border-0 disabled:opacity-50" title="Đính kèm ảnh" onClick={() => fileRef.current?.click()} disabled={sendingImg}>
                      <i className={sendingImg ? "fa-solid fa-circle-notch fa-spin text-lg" : "feather-paperclip text-[20px]"}></i>
                    </button>
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      className="form-control border-0 bg-transparent resize-none overflow-hidden max-h-[120px] focus:ring-0 text-[14.5px] font-medium text-slate-800 px-3 py-3 rounded-xl m-0 outline-none"
                      rows={1}
                      style={{ minHeight: '48px' }}
                      placeholder="Nhập tin nhắn..."
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={onKey}
                    />
                    {emojiOpen && (
                      <div className="absolute bottom-full left-0 mb-3 bg-white border border-slate-100 shadow-2xl rounded-2xl p-3 grid grid-cols-5 gap-2 w-[280px] z-50 origin-bottom-left animate-zoom-in">
                        <div className="col-span-5 mb-1 pb-2 border-b border-slate-100">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cảm xúc</span>
                        </div>
                        {EMOJIS.map((em) => (
                          <button key={em} type="button" className="w-10 h-10 flex items-center justify-center text-xl hover:bg-slate-100 rounded-xl transition-all border-0 bg-transparent cursor-pointer hover:scale-110 active:scale-95" onClick={() => pickEmoji(em)}>
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pb-1 pr-1">
                    <button type="button" className={`w-10 h-10 border-0 rounded-full flex items-center justify-center transition-all ${emojiOpen ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`} onClick={() => setEmojiOpen((o) => !o)}>
                      <i className="fa-regular fa-face-smile text-[20px]"></i>
                    </button>
                    <button type="button" className="ml-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 h-11 font-bold shadow-md shadow-emerald-500/30 transition-transform active:scale-95 border-0 disabled:opacity-50 disabled:active:scale-100" onClick={handleSend} disabled={!inputText.trim()}>
                      <i className="feather-send text-[18px]"></i> <span className="hidden sm:inline">Gửi</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* /Chat Right */}
      </div>
    </div>
  );
}

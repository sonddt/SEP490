import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import chatApi from '../api/chatApi';
import { findDirectRoom, roomIdOf } from '../utils/chatDirectRoom';
import { getChatHubUrl } from '../utils/chatHubUrl';
import { notifyInfo, notifyWarning } from '../hooks/useNotification';
import ChatDock from '../components/chat/ChatDock';
import { ChatContext } from './chatContext';

function messageRoomId(msg) {
  return String(msg.roomId ?? msg.RoomId ?? '');
}

function senderId(msg) {
  return msg.senderUserId ?? msg.SenderUserId;
}

export function ChatProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [connStatus, setConnStatus] = useState('Chưa đăng nhập');
  const [hubConnected, setHubConnected] = useState(false);
  const [openingPeerId, setOpeningPeerId] = useState(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const toggleChatPanel = useCallback(() => setChatPanelOpen(p => !p), []);
  const openChatPanel = useCallback(() => setChatPanelOpen(true), []);
  const closeChatPanel = useCallback(() => setChatPanelOpen(false), []);

  const connRef = useRef(null);
  const subscribersRef = useRef(new Map());
  const joinCountsRef = useRef(new Map());
  const userIdRef = useRef(user?.id);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHubConnected(false);
      setConnStatus('Chưa đăng nhập');
    }
  }, [isAuthenticated]);

  const subscribeToRoom = useCallback((roomId, handler) => {
    const key = String(roomId);
    let set = subscribersRef.current.get(key);
    if (!set) {
      set = new Set();
      subscribersRef.current.set(key, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) subscribersRef.current.delete(key);
    };
  }, []);

  const acquireRoom = useCallback((roomId) => {
    const key = String(roomId);
    const m = joinCountsRef.current;
    const c = (m.get(key) || 0) + 1;
    m.set(key, c);
    if (c === 1 && connRef.current?.state === signalR.HubConnectionState.Connected) {
      connRef.current.invoke('JoinRoom', key).catch(() => { });
    }
  }, []);

  const releaseRoom = useCallback((roomId) => {
    const key = String(roomId);
    const m = joinCountsRef.current;
    const c = (m.get(key) || 1) - 1;
    if (c <= 0) {
      m.delete(key);
      if (connRef.current?.state === signalR.HubConnectionState.Connected) {
        connRef.current.invoke('LeaveRoom', key).catch(() => { });
      }
    } else {
      m.set(key, c);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setConnStatus('Chưa có token');
      return undefined;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(getChatHubUrl(), {
        accessTokenFactory: () => localStorage.getItem('token') || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const notifyMsg = (msg) => {
      const key = messageRoomId(msg);
      if (key) {
        const subs = subscribersRef.current.get(key);
        if (subs) subs.forEach((h) => h(msg));
      }
    };

    conn.on('ReceiveMessage', notifyMsg);
    conn.on('MessageSent', notifyMsg);
    conn.onreconnecting(() => {
      setHubConnected(false);
      setConnStatus('Kết nối lại…');
    });
    conn.onreconnected(() => {
      setHubConnected(true);
      setConnStatus('Đã kết nối');
      joinCountsRef.current.forEach((count, roomId) => {
        if (count > 0) conn.invoke('JoinRoom', roomId).catch(() => { });
      });
    });
    conn.onclose(() => {
      setHubConnected(false);
      setConnStatus('Mất kết nối');
    });

    conn
      .start()
      .then(() => {
        setHubConnected(true);
        setConnStatus('Đã kết nối');
        connRef.current = conn;
        joinCountsRef.current.forEach((count, roomId) => {
          if (count > 0) conn.invoke('JoinRoom', roomId).catch(() => { });
        });
      })
      .catch(() => {
        setHubConnected(false);
        setConnStatus('Không kết nối được hub');
      });

    return () => {
      connRef.current = null;
      setHubConnected(false);
      conn.stop().catch(() => { });
    };
  }, [isAuthenticated]);

  const sendHubMessage = useCallback(async (roomId, messageText, fileId) => {
    const conn = connRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Chưa kết nối chat.');
    }
    const text = messageText?.trim() ? messageText.trim() : '';
    await conn.invoke(
      'SendMessage',
      String(roomId),
      text || null,
      fileId ?? null
    );
  }, []);

  const openChatWithPeer = useCallback(
    async ({ userId, fullName, avatarUrl }) => {
      if (!user?.id || !userId) return;
      if (String(userId) === String(user.id)) {
        notifyInfo('Không thể chat với chính mình.');
        return;
      }
      setOpeningPeerId(String(userId));
      try {
        const rooms = await chatApi.getRooms();
        const list = Array.isArray(rooms) ? rooms : [];
        let room = findDirectRoom(list, user.id, userId);
        if (!room) {
          const label = fullName?.trim() || 'Bạn bè';
          room = await chatApi.createRoom({
            name: `Chat với ${label}`,
            memberIds: [userId],
          });
        }
        const rid = roomIdOf(room);
        if (!rid) throw new Error('Thiếu room id');
        // Room resolved — caller can navigate to /user/chat if needed
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Không mở được cuộc trò chuyện.';
        notifyWarning(msg);
      } finally {
        setOpeningPeerId(null);
      }
    },
    [user?.id]
  );

  const value = {
    connStatus,
    hubConnected,
    openingPeerId,
    openChatWithPeer,
    subscribeToRoom,
    acquireRoom,
    releaseRoom,
    sendHubMessage,
    chatPanelOpen,
    toggleChatPanel,
    openChatPanel,
    closeChatPanel,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
      {isAuthenticated ? <ChatDock /> : null}
    </ChatContext.Provider>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import ChatPanel from './ChatPanel';

/**
 * Floating draggable badminton-themed FAB + ChatPanel.
 * Replaces the old vertical edge tab.
 */
export default function FriendsChatRail() {
  const { pathname } = useLocation();
  const { chatPanelOpen, toggleChatPanel } = useChat();

  /* ─── drag state ─────────────────────────────────── */
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 140 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  const fabRef = useRef(null);

  const clamp = useCallback((x, y) => {
    const size = 56;
    return {
      x: Math.max(8, Math.min(window.innerWidth - size - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - size - 8, y)),
    };
  }, []);

  /* pointer handlers */
  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    wasDragged.current = false;
    const rect = fabRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    wasDragged.current = true;
    const next = clamp(e.clientX - offset.current.x, e.clientY - offset.current.y);
    setPos(next);
  }, [clamp]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleClick = useCallback(() => {
    if (wasDragged.current) return;     // ignore click after drag
    toggleChatPanel();
  }, [toggleChatPanel]);

  /* keep inside viewport on resize */
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p.x, p.y));
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  /* Hidden on admin / manager */
  if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* ── Floating Action Button ── */}
      <div
        ref={fabRef}
        className={`shuttle-chat-fab ${chatPanelOpen ? '--active' : ''}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
        title="Mở chat"
      >
        {/* Chat bubble icon */}
        <svg className="shuttle-chat-fab__icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main chat bubble */}
          <path d="M12 14 h28 a6 6 0 0 1 6 6 v14 a6 6 0 0 1-6 6 H26 l-8 8 v-8 H16 a6 6 0 0 1-6-6 V20 a6 6 0 0 1 6-6 Z" fill="#fff" opacity="0.95" />
          {/* Chat lines */}
          <path d="M20 24 h16 M20 30 h10" stroke="rgba(9,126,82,0.7)" strokeWidth="2.5" strokeLinecap="round" />
          {/* Small secondary bubble */}
          <path d="M34 38 h12 a4 4 0 0 1 4 4 v8 a4 4 0 0 1-4 4 h-2 v5 l-5-5 H34 a4 4 0 0 1-4-4 v-8 a4 4 0 0 1 4-4 Z" fill="rgba(255,255,255,0.7)" />
          <path d="M36 44 h8 M36 48 h5" stroke="rgba(9,126,82,0.5)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Pulse ring */}
        <span className="shuttle-chat-fab__pulse"></span>
      </div>

      {/* ── Chat Panel ── */}
      <ChatPanel />
    </>
  );
}
